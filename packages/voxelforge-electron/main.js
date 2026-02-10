const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { spawn } = require('node:child_process');

const RECENT_MAX = 10;
const PROJECT_MARKER = 'voxelyn.project.json';
const RECENT_FILE_NAME = 'recent-projects.json';
const CLI_ENTRY_FILE = path.join('dist', 'src', 'index.js');
const CLI_BUNDLED_RELS = [
  path.join('voxelyn-cli', CLI_ENTRY_FILE),
  path.join('cli', 'voxelyn-cli', CLI_ENTRY_FILE),
];
const CLI_DEV_RELS = [
  path.join('..', 'voxelyn-cli', CLI_ENTRY_FILE),
  path.join('..', '..', 'voxelyn-cli', CLI_ENTRY_FILE),
];

const ALLOWED_CLI_PRIMARY = new Set([
  'create',
  'dev',
  'build',
  'preview',
  'serve',
  'deploy',
  'generate',
  'plugin',
  '--help',
  '--list',
  '--version',
]);

const PROJECT_CONTEXT_REQUIRED = new Set([
  'dev',
  'build',
  'preview',
  'serve',
  'deploy',
  'generate',
  'plugin',
]);

let mainWindow = null;
let currentProjectRoot = null;
let recentProjects = [];
const cliRuns = new Map();

let runCounter = 0;
const createRunId = () => {
  runCounter += 1;
  return `run_${Date.now().toString(36)}_${runCounter.toString(36)}`;
};

const getRecentFilePath = () => path.join(app.getPath('userData'), RECENT_FILE_NAME);

const pathExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const isDirectory = async (target) => {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory();
  } catch {
    return false;
  }
};

const loadRecentProjects = async () => {
  const filePath = getRecentFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      recentProjects = [];
      return;
    }
    const normalized = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string') continue;
      const absolute = path.resolve(entry);
      if (!normalized.includes(absolute) && (await isDirectory(absolute))) {
        normalized.push(absolute);
      }
    }
    recentProjects = normalized.slice(0, RECENT_MAX);
  } catch {
    recentProjects = [];
  }
};

const saveRecentProjects = async () => {
  const filePath = getRecentFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(recentProjects, null, 2), 'utf8');
};

const addRecentProject = async (projectPath) => {
  const absolute = path.resolve(projectPath);
  recentProjects = [absolute, ...recentProjects.filter((item) => item !== absolute)].slice(0, RECENT_MAX);
  await saveRecentProjects();
};

const validateProjectDirectory = async (projectPath) => {
  const markerPath = path.join(projectPath, PROJECT_MARKER);
  if (await pathExists(markerPath)) {
    return { valid: true, reason: 'marker' };
  }

  const packageJson = await pathExists(path.join(projectPath, 'package.json'));
  const srcDir = await isDirectory(path.join(projectPath, 'src'));
  const viteConfig = await pathExists(path.join(projectPath, 'vite.config.ts'));
  const indexHtml = await pathExists(path.join(projectPath, 'index.html'));
  if (packageJson && srcDir && (viteConfig || indexHtml)) {
    return { valid: true, reason: 'web-project' };
  }

  const generatedDir = await isDirectory(path.join(projectPath, 'assets', 'generated'));
  const scenesDir = await isDirectory(path.join(projectPath, 'scenes'));
  const worldsDir = await isDirectory(path.join(projectPath, 'worlds'));
  if (generatedDir || scenesDir || worldsDir) {
    return { valid: true, reason: 'content-structure' };
  }

  return { valid: false, reason: 'missing-marker-and-structure' };
};

const dedupeMenuTemplate = (items) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item || item.type === 'separator') {
      result.push(item);
      continue;
    }

    const key =
      typeof item.id === 'string'
        ? `id:${item.id}`
        : typeof item.role === 'string'
          ? `role:${item.role}`
          : typeof item.label === 'string'
            ? `label:${item.label}`
            : null;

    if (key && seen.has(key)) {
      continue;
    }
    if (key) {
      seen.add(key);
    }

    const nextItem = { ...item };
    if (Array.isArray(nextItem.submenu)) {
      nextItem.submenu = dedupeMenuTemplate(nextItem.submenu);
    }
    result.push(nextItem);
  }

  return result;
};

const sendToRenderer = (channel, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
};

const sendUiCommand = (type, payload = {}) => {
  sendToRenderer('ui:command', { type, payload });
};

const parseCliPrimary = (args) => {
  if (!Array.isArray(args) || args.length === 0) return null;
  const first = typeof args[0] === 'string' ? args[0].trim() : '';
  if (!first) return null;
  return first;
};

const validateCliArgs = (args) => {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('CLI args must be a non-empty string array.');
  }
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new Error('CLI args must contain only strings.');
    }
  }

  const primary = parseCliPrimary(args);
  if (!primary || !ALLOWED_CLI_PRIMARY.has(primary)) {
    throw new Error(`CLI command not allowed: ${primary ?? '<empty>'}`);
  }

  if (primary === 'plugin') {
    const action = args[1];
    if (action && !['add', 'remove', 'list'].includes(action)) {
      throw new Error(`Plugin action not allowed: ${action}`);
    }
  }

  return primary;
};

const resolveCliEntryPath = async () => {
  const envOverride = process.env.VOXELYN_CLI_ENTRY;
  if (envOverride && envOverride.trim().length > 0) {
    const resolved = path.resolve(envOverride);
    if (await pathExists(resolved)) return resolved;
  }

  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = path.resolve(candidate);
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  for (const rel of CLI_BUNDLED_RELS) {
    addCandidate(path.resolve(process.resourcesPath, rel));
    addCandidate(path.resolve(process.resourcesPath, 'app.asar.unpacked', rel));
    addCandidate(path.resolve(process.resourcesPath, 'app.asar', rel));
    addCandidate(path.resolve(__dirname, rel));
    addCandidate(path.resolve(__dirname, '..', 'app.asar.unpacked', rel));
    addCandidate(path.resolve(__dirname, '..', 'app.asar', rel));
  }

  for (const rel of CLI_DEV_RELS) {
    addCandidate(path.resolve(__dirname, rel));
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }

  throw new Error(
    `Voxelyn CLI entry not found. Checked: ${candidates.join(', ')}`
  );
};

const canSpawnCommand = async (command) => {
  if (typeof command !== 'string' || command.trim().length === 0) {
    return false;
  }
  return await new Promise((resolve) => {
    const probe = spawn(command, ['--version'], {
      stdio: 'ignore',
      shell: false,
    });
    probe.once('error', () => {
      resolve(false);
    });
    probe.once('close', () => {
      resolve(true);
    });
  });
};

const resolveCliInvocation = async (args) => {
  try {
    const cliEntryPath = await resolveCliEntryPath();
    return {
      command: process.execPath,
      argv: [cliEntryPath, ...args],
      mode: 'embedded',
      details: cliEntryPath,
    };
  } catch (embeddedError) {
    const envBin = process.env.VOXELYN_CLI_BIN?.trim();
    const fallbackCommands = envBin ? [envBin] : ['voxelyn'];
    for (const fallback of fallbackCommands) {
      // Fallback only when bundled entry is unavailable.
      if (await canSpawnCommand(fallback)) {
        return {
          command: fallback,
          argv: [...args],
          mode: 'fallback',
          details: fallback,
        };
      }
    }

    const message =
      embeddedError instanceof Error ? embeddedError.message : String(embeddedError);
    throw new Error(
      `${message}\nFallback CLI command not found. Reinstall the app build that bundles the CLI, or set VOXELYN_CLI_ENTRY/VOXELYN_CLI_BIN.`
    );
  }
};

const resolveCliCwd = async (requestedCwd, primary) => {
  let cwd = requestedCwd;
  if (typeof cwd !== 'string' || cwd.trim().length === 0) {
    if (PROJECT_CONTEXT_REQUIRED.has(primary)) {
      cwd = currentProjectRoot;
    } else {
      cwd = process.cwd();
    }
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error(`Command "${primary}" requires an active project folder.`);
  }

  const resolved = path.resolve(cwd);
  if (!(await isDirectory(resolved))) {
    throw new Error(`Invalid CLI cwd: ${resolved}`);
  }
  return resolved;
};

const runCli = async ({ cwd, args }) => {
  const primary = validateCliArgs(args);
  const invocation = await resolveCliInvocation(args);
  const resolvedCwd = await resolveCliCwd(cwd, primary);
  const runId = createRunId();

  const child = spawn(invocation.command, invocation.argv, {
    cwd: resolvedCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      FORCE_COLOR: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (invocation.mode === 'fallback') {
    sendToRenderer('cli:stderr', {
      runId,
      chunk: `[voxelforge] Bundled CLI not found. Using fallback command "${invocation.details}".\n`,
    });
  }

  cliRuns.set(runId, {
    child,
    args: [...args],
    cwd: resolvedCwd,
    startedAt: Date.now(),
    cancelRequested: false,
  });

  child.stdout.on('data', (chunk) => {
    sendToRenderer('cli:stdout', {
      runId,
      chunk: Buffer.from(chunk).toString('utf8'),
    });
  });

  child.stderr.on('data', (chunk) => {
    sendToRenderer('cli:stderr', {
      runId,
      chunk: Buffer.from(chunk).toString('utf8'),
    });
  });

  child.on('error', (error) => {
    sendToRenderer('cli:error', { runId, message: error.message });
  });

  child.on('close', (code, signal) => {
    const info = cliRuns.get(runId);
    cliRuns.delete(runId);
    sendToRenderer('cli:exit', {
      runId,
      code: typeof code === 'number' ? code : -1,
      signal: signal ?? null,
      canceled: Boolean(info?.cancelRequested),
      endedAt: Date.now(),
    });
  });

  return {
    runId,
    cwd: resolvedCwd,
    args: [...args],
    startedAt: Date.now(),
  };
};

const cancelCliRun = async (runId) => {
  if (typeof runId !== 'string' || runId.trim().length === 0) {
    throw new Error('Missing runId.');
  }
  const info = cliRuns.get(runId);
  if (!info) return;
  info.cancelRequested = true;

  if (!info.child.killed) {
    info.child.kill('SIGTERM');
  }
  setTimeout(() => {
    if (cliRuns.has(runId) && !info.child.killed) {
      info.child.kill('SIGKILL');
    }
  }, 1200);
};

const activateProjectPath = async (selectedPath) => {
  const normalized = path.resolve(selectedPath);
  const validation = await validateProjectDirectory(normalized);
  if (!validation.valid) {
    throw new Error('Selected path is not a valid Voxelyn project.');
  }

  currentProjectRoot = normalized;
  await addRecentProject(normalized);
  updateMenu();
  sendToRenderer('voxelyn:project-opened', { path: normalized });
  return { path: normalized };
};

const closeProject = async () => {
  currentProjectRoot = null;
  updateMenu();
  sendToRenderer('voxelyn:project-opened', { path: null });
};

const selectDirectory = async () => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: 'Select Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return { path: path.resolve(result.filePaths[0]) };
};

const updateMenu = () => {
  const openRecentMenu = recentProjects.length
    ? recentProjects.map((projectPath) => ({
        label: projectPath,
        click: async () => {
          const validation = await validateProjectDirectory(projectPath);
          if (!validation.valid) {
            recentProjects = recentProjects.filter((item) => item !== projectPath);
            await saveRecentProjects();
            updateMenu();
            dialog.showErrorBox(
              'Invalid Voxelyn Project',
              `The folder is no longer a valid Voxelyn project:\n${projectPath}`
            );
            return;
          }
          currentProjectRoot = projectPath;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('voxelyn:project-opened', { path: projectPath });
          }
          await addRecentProject(projectPath);
          updateMenu();
        },
      }))
    : [{ label: 'No Recent Projects', enabled: false }];

  const template = [
    {
      label: 'File',
      submenu: [
        {
          id: 'file.newProject',
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendUiCommand('new-project'),
        },
        {
          id: 'file.openProject',
          label: 'Open Project Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            await openProjectFolder();
          },
        },
        {
          id: 'file.openRecent',
          label: 'Open Recent',
          submenu: openRecentMenu,
        },
        {
          id: 'file.closeProject',
          label: 'Close Project',
          enabled: Boolean(currentProjectRoot),
          click: async () => {
            await closeProject();
          },
        },
        { type: 'separator' },
        {
          id: 'file.runCli',
          label: 'Run CLI Command...',
          click: () => sendUiCommand('run-cli'),
        },
        { type: 'separator' },
        {
          id: 'file.closeQuit',
          label: process.platform === 'darwin' ? 'Close' : 'Quit',
          role: process.platform === 'darwin' ? 'close' : 'quit',
        },
      ],
    },
    {
      id: 'project',
      label: 'Project',
      submenu: [
        { id: 'project.generate.texture', label: 'Generate Texture...', click: () => sendUiCommand('generate', { type: 'texture' }) },
        { id: 'project.generate.scenario', label: 'Generate Scenario...', click: () => sendUiCommand('generate', { type: 'scenario' }) },
        { id: 'project.generate.other', label: 'Generate Other...', click: () => sendUiCommand('generate', { type: 'other' }) },
        { type: 'separator' },
        { id: 'project.refresh', label: 'Refresh Project Index', click: () => sendUiCommand('refresh-project') },
        {
          id: 'project.reveal',
          label: process.platform === 'darwin' ? 'Reveal in Finder' : 'Reveal in File Explorer',
          click: () => {
            if (currentProjectRoot) {
              shell.showItemInFolder(currentProjectRoot);
            }
          },
        },
      ],
    },
    {
      id: 'build',
      label: 'Build',
      submenu: [
        { id: 'build.dev', label: 'Dev...', click: () => sendUiCommand('run-preset', { command: 'dev' }) },
        { id: 'build.build', label: 'Build...', click: () => sendUiCommand('run-preset', { command: 'build' }) },
        { id: 'build.preview', label: 'Preview...', click: () => sendUiCommand('run-preset', { command: 'preview' }) },
        { id: 'build.serve', label: 'Serve...', click: () => sendUiCommand('run-preset', { command: 'serve' }) },
        { id: 'build.deploy', label: 'Deploy...', click: () => sendUiCommand('deploy') },
      ],
    },
    {
      id: 'plugins',
      label: 'Plugins',
      submenu: [
        { id: 'plugins.add', label: 'Add Plugin...', click: () => sendUiCommand('plugin', { action: 'add' }) },
        { id: 'plugins.remove', label: 'Remove Plugin...', click: () => sendUiCommand('plugin', { action: 'remove' }) },
        { id: 'plugins.list', label: 'List Plugins', click: () => sendUiCommand('plugin', { action: 'list' }) },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }],
    },
    {
      id: 'view',
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { id: 'window', label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
    {
      id: 'help',
      label: 'Help',
      submenu: [
        { id: 'help.cliHelp', label: 'Voxelyn CLI Help', click: () => sendUiCommand('cli-help') },
        {
          id: 'help.about',
          label: 'About',
          click: () => {
            const detail = `VoxelForge\nElectron ${process.versions.electron}\nNode ${process.versions.node}`;
            dialog.showMessageBox(mainWindow ?? undefined, {
              type: 'info',
              title: 'About VoxelForge',
              message: 'VoxelForge',
              detail,
            });
          },
        },
      ],
    },
  ];
  const sanitizedTemplate = dedupeMenuTemplate(template);
  Menu.setApplicationMenu(Menu.buildFromTemplate(sanitizedTemplate));
};

const resolveWithinProject = (relPath = '.') => {
  if (!currentProjectRoot) {
    throw new Error('No project folder is open.');
  }
  if (typeof relPath !== 'string') {
    throw new Error('Expected relative path string.');
  }
  const root = path.resolve(currentProjectRoot);
  const target = path.resolve(root, relPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${relPath}`);
  }
  return target;
};

const decodeTextIfUtf8 = (buffer) => {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch {
    return null;
  }
};

const openProjectFolder = async () => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: 'Open Voxelyn Project Folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = path.resolve(result.filePaths[0]);
  const validation = await validateProjectDirectory(selectedPath);
  if (!validation.valid) {
    dialog.showErrorBox(
      'Invalid Voxelyn Project',
      `The selected folder does not look like a Voxelyn project.\n\nExpected ${PROJECT_MARKER} or standard CLI project structure.`
    );
    return null;
  }

  return activateProjectPath(selectedPath);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'VoxelForge',
    backgroundColor: '#12121a',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    if (process.env.VITE_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    return;
  }

  const indexPath = path.join(__dirname, 'renderer', 'index.html');
  mainWindow.loadFile(indexPath).catch((error) => {
    console.error('Failed to load renderer:', indexPath);
    console.error(error);
  });
};

ipcMain.handle('voxelyn:open-project-folder', async () => openProjectFolder());
ipcMain.handle('voxelyn:open-project-path', async (_event, projectPath) => {
  if (typeof projectPath !== 'string' || projectPath.trim().length === 0) {
    throw new Error('Missing project path.');
  }
  return activateProjectPath(projectPath);
});
ipcMain.handle('voxelyn:project-read-file', async (_event, relPath) => {
  const target = resolveWithinProject(relPath);
  const content = await fs.readFile(target);
  const decoded = decodeTextIfUtf8(content);
  return decoded ?? Uint8Array.from(content);
});
ipcMain.handle('voxelyn:project-read-dir', async (_event, relPath = '.') => {
  const target = resolveWithinProject(relPath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? 'directory' : 'file',
  }));
});
ipcMain.handle('voxelyn:project-exists', async (_event, relPath) => {
  const target = resolveWithinProject(relPath);
  return pathExists(target);
});
ipcMain.handle('voxelyn:project-write-file', async (_event, relPath, data) => {
  const target = resolveWithinProject(relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (typeof data === 'string') {
    await fs.writeFile(target, data, 'utf8');
    return;
  }
  if (data instanceof Uint8Array) {
    await fs.writeFile(target, data);
    return;
  }
  if (data instanceof ArrayBuffer) {
    await fs.writeFile(target, Buffer.from(data));
    return;
  }
  throw new Error('Unsupported file payload type.');
});
ipcMain.handle('voxelyn:project-join', async (_event, ...rel) => path.join(...rel.map((part) => String(part))));
ipcMain.handle('voxelyn:select-directory', async () => selectDirectory());
ipcMain.handle('cli:run', async (_event, payload) => runCli(payload ?? {}));
ipcMain.handle('cli:cancel', async (_event, payload) => {
  await cancelCliRun(payload?.runId);
});

app.whenReady().then(async () => {
  app.setName('VoxelForge');
  await loadRecentProjects();
  createWindow();
  updateMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      updateMenu();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

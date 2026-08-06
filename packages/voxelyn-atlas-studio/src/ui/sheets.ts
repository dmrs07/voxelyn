// Folhas compartilhadas entre o editor pixel e o editor voxel.
import type { Project } from '../types';
import { packProject } from '../atlas';
import { validateProject } from '../validate';
import { downloadBlob, gridToBlob, shareFiles } from '../png';
import { el, openSheet, toast } from './components';

export const openExportSheet = (project: Project, onVersionChange: () => void): Promise<void> =>
  openSheet((close) => {
    const container = el('div');
    const issues = validateProject(project);
    const issuesBox = el('div', { class: 'issues' });
    if (issues.length === 0) {
      issuesBox.append(
        el('div', { class: 'issue ok', text: '✓ Tudo dentro do contrato da Art Bible' }),
      );
    }
    for (const issue of issues) {
      issuesBox.append(
        el('div', {
          class: `issue ${issue.level}`,
          text: `${issue.level === 'error' ? '✕' : '⚠'} ${issue.message}`,
        }),
      );
    }
    const versionInput = el('input', { type: 'number', min: '1', value: String(project.version) });
    const { atlas, manifest, totalFrames } = packProject(project);
    const info = el('p', {
      class: 'sub',
      text: `Atlas: ${atlas.w}×${atlas.h}px · ${totalFrames} frames · ${manifest.paletteColors.length} cores`,
    });

    const buildFiles = async (): Promise<{ png: File; json: File }> => {
      project.version = Math.max(1, Number(versionInput.value) || project.version);
      onVersionChange();
      const packed = packProject(project);
      const blob = await gridToBlob(packed.atlas);
      const json = `${JSON.stringify(packed.manifest, null, 2)}\n`;
      return {
        png: new File([blob], `${project.spriteId}.png`, { type: 'image/png' }),
        json: new File([json], `${project.spriteId}.json`, { type: 'application/json' }),
      };
    };

    const downloadBtn = el('button', { class: 'primary', text: '⬇ Baixar PNG + JSON' });
    downloadBtn.addEventListener('click', () => {
      void buildFiles().then(({ png, json }) => {
        downloadBlob(png, png.name);
        downloadBlob(json, json.name);
        toast(
          `Exportado: ${png.name} + ${json.name} → mova para packages/voxelyn-survival-content/assets/atlases/`,
        );
        close();
      });
    });
    const shareBtn = el('button', { text: '📤 Compartilhar arquivos' });
    shareBtn.addEventListener('click', () => {
      void buildFiles().then(async ({ png, json }) => {
        const ok = await shareFiles([png, json], project.spriteId);
        if (!ok) toast('Web Share indisponivel — use o download');
        else close();
      });
    });

    container.append(
      el('h2', { text: 'Validar & exportar' }),
      issuesBox,
      info,
      el('div', {}, [
        el('label', { text: 'Versao do manifest (incremente quando o PNG mudar)' }),
        versionInput,
      ]),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [downloadBtn, shareBtn]),
    );
    return container;
  });

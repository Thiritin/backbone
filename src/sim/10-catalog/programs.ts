// docs/design/web-hosting.md 4.4: desktop programs that are a free download from their own site.
export interface Program { id: string; host: string; from: number; versions: [year: number, version: string, mb: number][] }

// FileGorilla follows FileZilla's release numbers; every release ships as a disk image.
export const PROGRAMS: Program[] = [
  {
    id: "FileGorilla", host: "filegorilla-project.org", from: 2005,
    versions: [[2005, "2.2.15", 3], [2006, "2.2.30", 3], [2007, "3.0.3", 5], [2009, "3.3.0", 6], [2011, "3.5.3", 7], [2013, "3.7.3", 8], [2016, "3.24.0", 9], [2019, "3.46.0", 10], [2022, "3.62.2", 12]],
  },
];

export const programById = (id: string): Program | undefined => PROGRAMS.find((p) => p.id === id);
export const programRelease = (p: Program, year: number): { version: string; mb: number } => {
  const [, version, mb] = [...p.versions].reverse().find(([y]) => y <= year) ?? p.versions[0];
  return { version, mb };
};
export const installerFile = (p: Program, year: number): string => {
  const { version } = programRelease(p, year);
  return `${p.id}_${version}.dmg`;
};

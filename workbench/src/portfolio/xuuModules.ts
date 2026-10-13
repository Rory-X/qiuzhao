import coreModules from './xuuCoreModules.json';
import executionModules from './xuuExecutionModules.json';
import productModules from './xuuProductModules.json';

export interface XuuModuleCase {
  title: string;
  sha: string;
  date: string;
  problem: string;
  cause: string;
  solution: string;
  tradeoff: string;
  validation: string;
  files: string[];
}

export interface XuuModule {
  id: string;
  title: string;
  scope: string;
  cases: XuuModuleCase[];
}

export const xuuModuleGroups: { title: string; modules: XuuModule[] }[] = [
  { title: '核心运行', modules: coreModules },
  { title: '工具与协议', modules: executionModules },
  { title: '产品与协作', modules: productModules },
];

export const xuuModuleCount = xuuModuleGroups.reduce((total, group) => total + group.modules.length, 0);
export const xuuModuleCaseCount = xuuModuleGroups.reduce(
  (total, group) => total + group.modules.reduce((count, module) => count + module.cases.length, 0),
  0,
);

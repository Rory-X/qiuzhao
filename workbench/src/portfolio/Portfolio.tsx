import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Code2, Github, Image as ImageIcon, Moon, Sun } from 'lucide-react';
import { projects, projectPath, type Project } from './projects';
import './portfolio.css';
import { usePortfolioNavigation } from './usePortfolioNavigation';
import { revealApp } from '../boot';
import { xuuCacheCases } from './xuuCache';
import { xuuModuleGroups, xuuModuleCount, xuuModuleCaseCount } from './xuuModules';
import { projectJourneys } from './projectJourneys';
import { projectDepth } from './caseStudies';
import { screenshotSlots, screenshotUrl } from './screenshots';

const repoUrl = (project: Project) => `https://github.com/${project.repo}`;
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14} aria-hidden="true" /></a>;
}

function ProjectGallery({ project }: { project: Project }) {
  return <section className="pf-gallery" aria-labelledby="gallery-heading">
    <div className="pf-heading"><h2 id="gallery-heading">项目实景 <span>In practice</span></h2><span className="pf-count">01 — 03</span></div>
    <div className="pf-gallery-grid">{screenshotSlots[project.slug].map((slot, index) => {
      const image = screenshotUrl(project.slug, index);
      return <figure className={index === 0 ? 'pf-shot pf-shot-cover' : 'pf-shot'} key={slot.title}>
        {image ? <a className="pf-shot-image" href={image} target="_blank" rel="noopener noreferrer" aria-label={`查看大图：${slot.title}`}><img src={image} alt={`${project.name}：${slot.scene}`} loading="lazy" /></a> : <div className="pf-shot-placeholder"><ImageIcon size={23} strokeWidth={1} aria-hidden="true" /><strong>{slot.title}</strong><p>{slot.scene}</p><span>真实项目截图 · 待补充</span></div>}
        <figcaption><span>{String(index + 1).padStart(2, '0')} / {slot.title}</span><p>{slot.value}</p></figcaption>
      </figure>;
    })}</div>
  </section>;
}

function DesignChallenges({ project }: { project: Project }) {
  const depth = projectDepth[project.slug];
  return <section className="pf-section pf-challenges" id="design-challenges">
    <div className="pf-section-label"><span>04</span><h2>关键难点与设计取舍</h2></div>
    <p className="pf-challenge-intro">{depth.focus}</p>
    <div className="pf-case-list">{depth.cases.map((item, index) => <article className="pf-case" key={item.title}>
      <div className="pf-case-heading"><span className="pf-case-index">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><span className="pf-case-status">{item.status}</span></div>
      <dl><div><dt>难点</dt><dd>{item.problem}</dd></div><div><dt>设计选择</dt><dd>{item.decision}</dd></div><div><dt>取舍与边界</dt><dd>{item.tradeoff}</dd></div></dl>
      <details className="pf-case-evidence"><summary>依据与验证范围</summary><p>{item.evidence}</p><External href={`${repoUrl(project)}/blob/${project.slug === 'e-pi' ? 'master' : 'main'}/${item.source}`}>查看技术依据</External></details>
    </article>)}</div>
  </section>;
}

function CacheDeepDive() {
  return <section className="pf-section" id="cache-design">
    <div className="pf-section-label"><span>专题</span><h2>缓存攻克：前缀稳定，也要上下文新鲜</h2></div>
    <p className="pf-body-copy">核心是让后续请求尽量延续已有前缀，同时正确处理目标变化、历史重写和过期数据。下面沿代码演进拆解六个问题。</p>
    <div className="pf-case-list">{xuuCacheCases.map((item, i) => <article className="pf-case" key={item.sha}>
      <div className="pf-case-heading"><span className="pf-case-index">{String(i + 1).padStart(2, '0')}</span><h3>{item.title}</h3></div>
      <dl><div><dt>触发问题</dt><dd>{item.problem}</dd></div><div><dt>方案</dt><dd>{item.solution}</dd></div><div><dt>代价与边界</dt><dd>{item.tradeoff}</dd></div></dl>
      <details className="pf-case-evidence"><summary>提交与实现依据</summary><External href={`https://github.com/Rory-X/xuu/commit/${item.sha}`}>{item.sha.slice(0, 8)} · 查看改动</External><br /><External href={`https://github.com/Rory-X/xuu/blob/${item.sha}/${item.file}`}>查看当时的代码</External></details>
    </article>)}</div>
    <aside className="pf-source"><div><p>验证分两层：现有模拟会话测试覆盖稳定、变更、消失、重新激活和历史重写等前缀行为；真实缓存收益还需按提供方实测 cache read/write、首 Token 延迟、总成本与任务成功率。本次没有运行模型实验，不给出命中率或节省比例。</p></div></aside>
  </section>;
}

function XuuModuleDeepDive() {
  return <section className="pf-section pf-module-deep-dive" id="implementation-modules">
    <div className="pf-section-label"><span>专题</span><h2>Coding Agent 实现模块：问题与解法</h2></div>
    <p className="pf-body-copy">沿实际提交梳理 {xuuModuleCount} 个模块、{xuuModuleCaseCount} 个问题。每个案例都对应触发条件、实现选择和提交时的代码；它们记录的是仓库演进，不据此推定个人贡献。</p>
    <nav className="pf-module-index" aria-label="Coding Agent 模块目录">{xuuModuleGroups.map((group) => <div key={group.title}>
      <p>{group.title}</p>
      <div>{group.modules.map((module) => <a key={module.id} href={`#xuu-module-${module.id}`}>{module.title}<ArrowDown size={12} aria-hidden="true" /></a>)}</div>
    </div>)}</nav>
    {xuuModuleGroups.map((group) => <div className="pf-module-group" key={group.title}>
      <p className="pf-module-group-label">{group.title}</p>
      {group.modules.map((module) => <section className="pf-module" id={`xuu-module-${module.id}`} key={module.id} aria-labelledby={`xuu-module-title-${module.id}`}>
        <div className="pf-module-heading"><h3 id={`xuu-module-title-${module.id}`}>{module.title}</h3><span>{String(module.cases.length).padStart(2, '0')} 个案例</span></div>
        <p className="pf-module-scope">{module.scope}</p>
        <div className="pf-module-cases">{module.cases.map((item, i) => <article className="pf-case" key={item.sha}>
          <div className="pf-case-heading"><span className="pf-case-index">{String(i + 1).padStart(2, '0')}</span><h4>{item.title}</h4><span className="pf-case-status">{item.date}</span></div>
          <dl><div><dt>实际问题</dt><dd>{item.problem}</dd></div><div><dt>落地解法</dt><dd>{item.solution}</dd></div></dl>
          <details className="pf-case-evidence"><summary>成因、取舍与提交证据</summary>
            <dl><div><dt>成因</dt><dd>{item.cause}</dd></div><div><dt>边界</dt><dd>{item.tradeoff}</dd></div><div><dt>验证</dt><dd>{item.validation}</dd></div></dl>
            <div className="pf-module-sources"><External href={`https://github.com/Rory-X/xuu/commit/${item.sha}`}>提交 {item.sha.slice(0, 8)}</External>{item.files.map((file) => <External key={file} href={`https://github.com/Rory-X/xuu/blob/${item.sha}/${file}`}>{file}</External>)}</div>
          </details>
        </article>)}</div>
      </section>)}
    </div>)}
    <aside className="pf-source"><div><p>依据为 Rory-X/xuu 的提交差异、历史代码及相应测试文本，读取基线 44a00fe2（2026.09.23）。这里的“验证”指仓库中可核查的测试契约；本次未运行来源项目测试，也没有把评测方案写成已测得的收益。</p></div></aside>
  </section>;
}

function PracticeJourney({ project }: { project: Project }) {
  const journey = projectJourneys[project.slug];
  return <section className="pf-section pf-journey" id="practice-journey">
    <div className="pf-section-label"><span>05</span><h2>从提交记录看实践历程</h2></div>
    <p className="pf-body-copy">{journey.intro}。以下结合提交差异与历史代码，记录问题如何推动设计变化。</p>
    <p className="pf-journey-scope">仓库演进分析 · 读取基线 {journey.head.slice(0, 8)} · 2026.09.23<br />来源：{journey.repo} · 日期采用提交作者日期，不代表上线日期。历史包含多位作者与协作提交，不据仓库归属推定个人贡献；本次未运行来源项目测试。</p>
    <ol className="pf-timeline">{journey.stages.map((stage) => <li key={stage.title}>
      <p className="pf-timeline-date">{stage.date}</p><h3>{stage.title}</h3>
      <dl><div><dt>触发问题</dt><dd>{stage.before}</dd></div><div><dt>实现演进</dt><dd>{stage.change}</dd></div><div><dt>实践取舍</dt><dd>{stage.lesson}</dd></div></dl>
      <div className="pf-commit-links">{stage.commits.map((commit) => <External key={commit.sha} href={`https://github.com/${journey.repo}/commit/${commit.sha}`}><code>{commit.sha.slice(0, 8)}</code>{commit.label}</External>)}</div>
      <details className="pf-case-evidence"><summary>代码与回归契约</summary><p>{stage.contract}</p>{stage.commits.map((commit) => <div key={commit.sha}><External href={`https://github.com/${journey.repo}/blob/${commit.sha}/${commit.file}`}>{commit.file}</External></div>)}</details>
    </li>)}</ol>
  </section>;
}

function ProjectDetail({ project }: { project: Project }) {
  const index = projects.indexOf(project);
  const next = projects[(index + 1) % projects.length];
  return <>
    <a className="pf-back" href="/projects"><ArrowLeft size={15} />所有项目</a>
    <header className="pf-detail-hero">
      <p className="pf-eyebrow">PROJECT {String(index + 1).padStart(2, '0')} / {project.category}</p>
      <h1>{project.name}</h1>
      <p className="pf-lead">{project.intro}</p>
      <div className="pf-detail-links"><External href={repoUrl(project)}><Github size={16} />查看源码</External><a href="#engineering">工程设计 <ArrowDown size={14} /></a><a href="#design-challenges">难点与取舍 <ArrowDown size={14} /></a>{project.slug === 'xuu' && <><a href="#cache-design">缓存设计 <ArrowDown size={14} /></a><a href="#implementation-modules">模块解法 <ArrowDown size={14} /></a></>}<a href="#practice-journey">实践历程 <ArrowDown size={14} /></a></div>
    </header>
    <dl className="pf-meta"><div><dt>项目方向</dt><dd>{project.category}</dd></div><div><dt>技术栈</dt><dd>{project.stack.join(' · ')}</dd></div><div><dt>源码</dt><dd><External href={repoUrl(project)}>{project.repo}</External></dd></div></dl>
    <ProjectGallery project={project} />
    <section className="pf-section"><div className="pf-section-label"><span>01</span><h2>为什么做</h2></div><p className="pf-body-copy">{project.context}</p></section>
    <section className="pf-section"><div className="pf-section-label"><span>02</span><h2>能做什么</h2></div><div className="pf-feature-grid">{project.features.map((feature) => <div key={feature.title}><h3>{feature.title}</h3><p>{feature.text}</p></div>)}</div></section>
    <section className="pf-section" id="engineering"><div className="pf-section-label"><span>03</span><h2>如何实现</h2></div><ol className="pf-flow" aria-label="项目核心流程">{project.flow.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, '0')}</span><strong>{step}</strong>{i < project.flow.length - 1 && <ArrowRight size={14} aria-hidden="true" />}</li>)}</ol><div className="pf-engineering">{project.engineering.map((item) => <div key={item.title}><h3>{item.title}</h3><p>{item.text}</p></div>)}</div></section>
    {project.slug === 'xuu' && <CacheDeepDive />}
    {project.slug === 'xuu' && <XuuModuleDeepDive />}
    <DesignChallenges project={project} />
    <PracticeJourney project={project} />
    <aside className="pf-source"><Code2 size={17} /><div><p>{project.note || '项目介绍根据公开仓库 README 整理，具体能力与使用方式以源码和项目文档为准。'}</p><External href={`${repoUrl(project)}#readme`}>阅读项目文档</External></div></aside>
    <a className="pf-next" href={projectPath(next)}><div><span>下一个项目</span><strong>{next.name}</strong></div><ArrowRight size={23} /></a>
  </>;
}

function ProjectHome() {
  return <>
    <section className="pf-intro">
      <p className="pf-eyebrow">QIAN JIAHAO / PERSONAL PROJECTS</p>
      <h1>你好，我是钱嘉豪<span className="pf-period">.</span></h1>
      <p>用代码，把想法变成可以使用的工具。</p>
      <p>这里记录我的项目实践：从 AI Agent、桌面应用，<br className="pf-desktop-break" />到模型基础设施与面向真实场景的产品。</p>
      <div className="pf-intro-links"><a href="#selected">浏览项目 <ArrowDown size={14} /></a><External href="https://github.com/JustGenius-s"><Github size={16} />GitHub</External></div>
    </section>
    <section id="selected" className="pf-selected">
      <div className="pf-heading"><h2>项目 <span>Projects</span></h2><span className="pf-count">06</span></div>
      <div className="pf-project-grid">{projects.map((project, index) => <a className="pf-project-card" href={projectPath(project)} key={project.slug}>
        <div className="pf-card-top"><span>{String(index + 1).padStart(2, '0')}</span><ArrowUpRight size={17} aria-hidden="true" /></div>
        <h3>{project.name}</h3><p>{project.summary}</p><p className="pf-card-focus">{projectDepth[project.slug].focus}</p>
        <div className="pf-card-meta"><span><i className={`pf-language pf-language-${project.language === 'C++' ? 'cpp' : project.language.toLowerCase()}`} />{project.language}</span><span>{project.category}</span></div>
      </a>)}</div>
    </section>
    <section className="pf-about" id="about"><div><p className="pf-eyebrow">A LITTLE MORE</p><h2>在真实问题里，<br />打磨工程与产品。</h2></div><div><p>我关注 AI 如何走出对话框，进入开发者每天使用的工作流。桌面端、编辑器、模型服务与协作工具，是这些探索的不同切面。</p><p>每个项目都整理了使用场景、核心能力和工程设计，也保留了通往源码的入口。</p><div className="pf-about-links"><External href="https://github.com/JustGenius-s">JustGenius-s</External><External href="https://github.com/Rory-X">Rory-X</External></div></div></section>
  </>;
}

export default function Portfolio() {
  useEffect(revealApp, []);
  const { path, mainRef, onNavigate } = usePortfolioNavigation();
  const slug = path.slice('/projects/'.length);
  const project = projects.find((item) => item.slug === slug);
  const home = path === '/projects';
  const [dark, setDark] = useState(() => {
    try { const saved = localStorage.getItem('portfolio-theme'); if (saved) return saved === 'dark'; } catch { /* Storage may be unavailable. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.title = home ? '钱嘉豪 · 项目作品集' : project ? `${project.name} · 钱嘉豪` : '项目未找到 · 钱嘉豪';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    description.content = project?.intro || '钱嘉豪的项目作品集：AI Agent、桌面应用、模型基础设施与产品实践。';
  }, [home, project]);
  function toggleTheme() {
    setDark(!dark);
    try { localStorage.setItem('portfolio-theme', dark ? 'light' : 'dark'); } catch { /* Theme still works without persistence. */ }
  }
  return <div className="portfolio" onClick={onNavigate} data-theme={dark ? 'dark' : 'light'}>
    <a className="pf-skip" href="#main">跳转到内容</a>
    <header className="pf-header"><div className="pf-container pf-nav"><a className="pf-monogram" href="/projects" aria-label="钱嘉豪作品集首页">q<span>.</span></a><nav aria-label="作品集导航"><a href="/projects" aria-current={home || project ? 'page' : undefined}>项目</a><a href="/projects#about">关于</a><a className="pf-workspace-link" href="/">工作台 <ArrowUpRight size={12} /></a><button className="pf-theme" onClick={toggleTheme} aria-label={dark ? '切换为浅色主题' : '切换为深色主题'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></nav></div></header>
    <main id="main" ref={mainRef} tabIndex={-1} className={`pf-container ${home ? 'pf-home' : 'pf-detail'}`}>{home ? <ProjectHome /> : project ? <ProjectDetail project={project} /> : <section className="pf-not-found"><p className="pf-eyebrow">404 / PROJECT NOT FOUND</p><h1>这个项目还没有收录。</h1><a href="/projects"><ArrowLeft size={16} />返回项目列表</a></section>}</main>
    <footer className="pf-container pf-footer"><span>© {new Date().getFullYear()} 钱嘉豪</span><span>保持好奇，持续构建。</span><a href="https://github.com/JustGenius-s" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看 JustGenius-s"><Github size={16} /></a></footer>
  </div>;
}

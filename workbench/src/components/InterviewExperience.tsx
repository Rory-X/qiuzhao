import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronsUpDown,
  FileAudio,
  Filter,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { getInterviewAnswer } from "@/data/interviewAnswers";
import {
  interviewExperienceSections,
  interviewQuestionCount,
} from "@/data/interviewExperience";
import { cn } from "@/lib/utils";

const topics = ["全部", ...Array.from(new Set(interviewExperienceSections.flatMap((section) => section.tags)))];

export function InterviewExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [topic, setTopic] = useState("全部");
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");

    return interviewExperienceSections
      .filter((section) => topic === "全部" || section.tags.includes(topic))
      .map((section) => ({
        ...section,
        questions: section.questions.filter((question) => {
          if (!keyword) return true;
          return [question, section.title, section.company, ...section.tags]
            .join(" ")
            .toLocaleLowerCase("zh-CN")
            .includes(keyword);
        }),
      }))
      .filter((section) => section.questions.length > 0);
  }, [query, topic]);

  const visibleCount = filteredSections.reduce((total, section) => total + section.questions.length, 0);

  const toggleAll = () => {
    const next = !expanded;
    listRef.current?.querySelectorAll("details").forEach((detail) => {
      detail.open = next;
    });
    setExpanded(next);
  };

  return (
    <div className="page-stack experience-page">
      <section className="experience-hero">
        <div className="experience-hero-copy">
          <div className="experience-eyebrow"><FileAudio /> REAL INTERVIEW NOTES</div>
          <h1>真实面经 · AI / Agent 全栈题库</h1>
          <p>
            来自十余场真实面试录音的提问整理。每题下方附有 AI 生成的参考回答，
            用来补结构与盲区，不建议逐字背诵。
          </p>
          <div className="experience-stats" aria-label="题库统计">
            <span><b>{interviewQuestionCount}</b><small>真实问题</small></span>
            <span><b>{interviewExperienceSections.length}</b><small>录音批次</small></span>
            <span><b>100%</b><small>附参考答案</small></span>
          </div>
        </div>
        <div className="experience-stamp" aria-hidden="true">
          <Sparkles />
          <b>真题</b>
          <small>AI 整理</small>
        </div>
      </section>

      <section className="experience-toolbar" aria-label="筛选面试问题">
        <label className="experience-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 RAG、SSE、Vue、项目管理…"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="清空搜索">
              <X />
            </button>
          )}
        </label>

        <div className="experience-filter-row">
          <span><Filter /> 方向</span>
          <div className="experience-filter-chips">
            {topics.map((item) => (
              <button
                key={item}
                type="button"
                className={cn("filter-chip", topic === item && "active")}
                onClick={() => setTopic(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button type="button" className="experience-expand" onClick={toggleAll}>
            <ChevronsUpDown /> {expanded ? "全部收起" : "全部展开"}
          </button>
        </div>
      </section>

      <div className="experience-result-meta">
        <p><BookOpenCheck /> 当前显示 <b>{visibleCount}</b> 道题 · 点击问题展开参考答案</p>
        <small>涉及个人经历与数据的答案，请务必替换为可核验的真实内容。</small>
      </div>

      <div className="experience-sections" ref={listRef}>
        {filteredSections.map((section, sectionIndex) => (
          <section className="experience-section" key={`${section.company}-${section.round}`}>
            <header className="experience-section-head">
              <div className="experience-section-index">{String(sectionIndex + 1).padStart(2, "0")}</div>
              <div>
                <p>{section.company} · {section.round}</p>
                <h2>{section.title}</h2>
              </div>
              <div className="experience-section-tags">
                {section.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                <b>{section.questions.length} 题</b>
              </div>
            </header>

            <div className="experience-question-list">
              {section.questions.map((question, questionIndex) => {
                const answer = getInterviewAnswer(question);
                return (
                  <details className="experience-question" key={question}>
                    <summary>
                      <span>{String(questionIndex + 1).padStart(2, "0")}</span>
                      <b>{question}</b>
                      <em>参考答案</em>
                      <ChevronDown />
                    </summary>
                    <div className="experience-answer">
                      <div className="experience-answer-label"><Sparkles /> AI 参考作答</div>
                      <p className="experience-answer-lead">{answer.lead}</p>
                      <ul>
                        {answer.points.map((point) => <li key={point}>{point}</li>)}
                      </ul>
                      {answer.tip && <aside><b>回答提醒</b>{answer.tip}</aside>}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {filteredSections.length === 0 && (
        <section className="experience-empty">
          <Search />
          <h2>没有找到对应问题</h2>
          <p>换一个关键词，或清除当前方向筛选。</p>
          <button type="button" onClick={() => { setQuery(""); setTopic("全部"); }}>清除筛选</button>
        </section>
      )}
    </div>
  );
}

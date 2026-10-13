import { useEffect, useState } from "react";
import alibabaLogo from "@/assets/company-logos/alibaba.svg";
import baiduLogo from "@/assets/company-logos/baidu.svg";
import bytedanceLogo from "@/assets/company-logos/bytedance.svg";
import iflytekLogo from "@/assets/company-logos/iflytek.jpg";
import stepfunLogo from "@/assets/company-logos/stepfun.svg";
import xiaohongshuLogo from "@/assets/company-logos/xiaohongshu.svg";
import { cn } from "@/lib/utils";

const logoMatchers = [
  { aliases: ["字节跳动", "ByteDance"], logo: bytedanceLogo },
  { aliases: ["小红书", "Xiaohongshu"], logo: xiaohongshuLogo },
  { aliases: ["阶跃星辰", "StepStar", "StepFun"], logo: stepfunLogo },
  { aliases: ["阿里巴巴", "Alibaba"], logo: alibabaLogo },
  { aliases: ["科大讯飞", "iFLYTEK", "讯飞"], logo: iflytekLogo },
  { aliases: ["百度", "Baidu"], logo: baiduLogo },
];

function resolveLogo(company: string, logoUrl?: string) {
  if (logoUrl) return logoUrl;
  return logoMatchers.find((entry) => entry.aliases.some((alias) => company.includes(alias)))?.logo;
}

function companyMonogram(company: string) {
  const cleaned = company
    .replace(/^offerstar·/i, "")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/(股份有限公司|有限责任公司|有限公司|集团|科技|公司)$/g, "")
    .trim();
  if (/^[\x00-\x7F]+$/.test(cleaned)) {
    const words = cleaned.split(/[^a-z0-9]+/i).filter(Boolean);
    return (words.length > 1 ? words.map((word) => word[0]).join("") : cleaned.slice(0, 2)).toUpperCase();
  }
  return cleaned.slice(0, 2) || "企";
}

export function CompanyAvatar({ company, logoUrl, className }: { company: string; logoUrl?: string; className?: string }) {
  const logo = resolveLogo(company, logoUrl);
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logo && !failed);

  useEffect(() => setFailed(false), [company, logoUrl]);

  return (
    <span className={cn("company-avatar", showLogo && "logo-avatar", className)} aria-label={`${company} Logo`}>
      {showLogo ? (
        <img src={logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="company-monogram" aria-hidden="true">{companyMonogram(company)}</span>
      )}
    </span>
  );
}

from __future__ import annotations

import base64
import hashlib
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index.html", "zh.html")


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self.ids: set[str] = set()
        self.images: list[dict[str, str]] = []
        self.html_lang = ""

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        values = {key: value or "" for key, value in attrs}
        if "id" in values:
            self.ids.add(values["id"])
        if tag == "a":
            self.links.append(values)
        elif tag == "img":
            self.images.append(values)
        elif tag == "html":
            self.html_lang = values.get("lang", "")


class SharedAssetTests(unittest.TestCase):
    def test_shared_assets_exist(self) -> None:
        self.assertTrue((ROOT / "styles.css").is_file())
        self.assertTrue((ROOT / "script.js").is_file())


class EnglishPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = read_text("index.html")
        cls.parser = LinkCollector()
        cls.parser.feed(cls.html)

    def test_language_and_required_sections(self) -> None:
        self.assertEqual(self.parser.html_lang, "en")
        for section_id in (
            "main-content",
            "research",
            "publication",
            "awards",
            "skills",
        ):
            self.assertIn(section_id, self.parser.ids)

    def test_confirmed_identity_and_education(self) -> None:
        required = (
            "Zichen Zhang",
            "Peking University Health Science Center",
            "Clinical Medicine, five-year program",
            "Expected June 2028",
            "IELTS Academic 7.5",
        )
        for text in required:
            self.assertIn(text, self.html)

    def test_research_copy_is_specific_and_cautious(self) -> None:
        required = (
            "April 2026–Present",
            "Manuscript in preparation",
            "Undergraduate Honors Program in Biology",
            "March 2024–March 2027",
            "one to two research papers each week",
            "Professor Jiazhi Hu",
            "Comparison between Different Repli-HiC Fountains",
            "October 2025",
        )
        for text in required:
            self.assertIn(text, self.html)
        for forbidden in (
            "Cancer Boat Bridge",
            "foundation model training",
            "fine-tuned model weights",
        ):
            self.assertNotIn(forbidden, self.html)

    def test_new_research_projects_and_limits_are_public(self) -> None:
        required = (
            "National Institute of Health Data Science at Peking University",
            "September 2026 to Present",
            "Short-term seizure forecasting from scalp EEG",
            "patient-level data splits",
            "permutation test was not statistically significant",
            "does not yet establish clinical utility",
            "Selected output · UCHB 2026",
            "Local multi-omics features and systemic immune phenotypes",
            "First-author abstract and poster",
            "prospective validation in a patient-matched cohort",
        )
        for text in required:
            self.assertIn(text, self.html)
        self.assertEqual(self.html.count('class="selected-output"'), 1)
        for forbidden in (
            "clinically validated seizure predictor",
            "validated biomarker panel",
        ):
            self.assertNotIn(forbidden, self.html)

    def test_publication_is_formally_cited(self) -> None:
        required = (
            "cGAS–STING Signaling Pathway in Cancer Immunotherapy",
            "Chinese Journal of Biochemistry and Molecular Biology",
            "42(2): 184–192",
            "10.13865/j.cnki.cjbmb.2025.08.1219",
            "[in Chinese]",
        )
        for text in required:
            self.assertIn(text, self.html)

    def test_confirmed_awards_and_skills_are_present(self) -> None:
        required = (
            "9th Xieying Cup",
            "Champion",
            "16th Yimeng Cup",
            "Excellent Award",
            "Python",
            "Hi-C / Repli-HiC",
            "OpenAI Codex",
            "Ollama",
        )
        for text in required:
            self.assertIn(text, self.html)

    def test_no_dead_placeholder_links(self) -> None:
        self.assertNotIn('href="#"', self.html)


class ChinesePageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = read_text("zh.html") if (ROOT / "zh.html").exists() else ""
        cls.parser = LinkCollector()
        cls.parser.feed(cls.html)

    def test_language_and_required_sections(self) -> None:
        self.assertEqual(self.parser.html_lang, "zh-CN")
        for section_id in (
            "main-content",
            "research",
            "publication",
            "awards",
            "skills",
        ):
            self.assertIn(section_id, self.parser.ids)

    def test_confirmed_identity_and_education(self) -> None:
        required = (
            "张梓宸",
            "北京大学医学部",
            "临床医学专业（五年制）",
            "预计2028年6月毕业",
            "雅思总分7.5",
        )
        for text in required:
            self.assertIn(text, self.html)

    def test_research_and_poster_copy(self) -> None:
        required = (
            "北京大学肿瘤医院",
            "吴舟桥课题组",
            "2026年4月至今",
            "论文撰写中",
            "北京大学生命科学学院本科生训练项目",
            "2024年3月至2027年3月",
            "每周1-2篇文献阅读",
            "胡家志教授",
            "Comparison between Different Repli-HiC Fountains",
            "2025年10月",
        )
        for text in required:
            self.assertIn(text, self.html)
        self.assertNotIn("Cancer Boat Bridge", self.html)

    def test_new_research_projects_and_limits_are_public(self) -> None:
        required = (
            "北京大学健康医疗大数据国家研究院",
            "2026年9月至今",
            "基于头皮脑电的癫痫发作短期预测",
            "患者级数据划分",
            "置换检验尚未达到统计学显著性",
            "尚不能据此判断临床有效性",
            "阶段性成果 · UCHB 2026",
            "Local multi-omics features and systemic immune phenotypes",
            "第一作者摘要与墙报",
            "前瞻性、同患者队列中验证",
        )
        for text in required:
            self.assertIn(text, self.html)
        self.assertEqual(self.html.count('class="selected-output"'), 1)
        for forbidden in (
            "已通过临床验证的癫痫预测模型",
            "已验证的生物标志物组合",
        ):
            self.assertNotIn(forbidden, self.html)

    def test_formal_publication_and_awards(self) -> None:
        required = (
            "cGAS-STING信号通路在肿瘤免疫治疗中的作用",
            "中国生物化学与分子生物学报",
            "42(2)：184–192",
            "第九届“撷英杯”医学竞赛",
            "队长",
            "冠军",
            "第十六届“医盟杯”五校医学知识竞赛",
            "优秀奖",
        )
        for text in required:
            self.assertIn(text, self.html)


class CrossPageValidationTests(unittest.TestCase):
    def parsed(self, page: str) -> tuple[str, LinkCollector]:
        html = read_text(page)
        parser = LinkCollector()
        parser.feed(html)
        return html, parser

    def test_local_links_assets_and_internal_anchors_resolve(self) -> None:
        for page in PAGES:
            _, parser = self.parsed(page)
            for image in parser.images:
                src = image.get("src", "")
                self.assertTrue(
                    image.get("alt", "").strip(),
                    f"{page}: missing image alt",
                )
                if src and not urlparse(src).scheme:
                    self.assertTrue(
                        (ROOT / src).is_file(),
                        f"{page}: missing {src}",
                    )
            for link in parser.links:
                href = link.get("href", "")
                if href.startswith("#"):
                    self.assertIn(
                        href[1:],
                        parser.ids,
                        f"{page}: missing anchor {href}",
                    )
                elif (
                    href
                    and not urlparse(href).scheme
                    and not href.startswith("mailto:")
                ):
                    target = href.split("#", 1)[0]
                    self.assertTrue(
                        (ROOT / target).is_file(),
                        f"{page}: missing {target}",
                    )

    def test_external_blank_targets_are_safe(self) -> None:
        for page in PAGES:
            _, parser = self.parsed(page)
            for link in parser.links:
                if link.get("target") == "_blank":
                    rel = set(link.get("rel", "").split())
                    self.assertTrue(
                        {"noopener", "noreferrer"}.issubset(rel),
                        f"{page}: unsafe target",
                    )

    def test_reciprocal_language_links_and_shared_assets(self) -> None:
        english = read_text("index.html")
        chinese = read_text("zh.html")
        self.assertIn('href="zh.html"', english)
        self.assertIn('href="index.html"', chinese)
        for html in (english, chinese):
            self.assertIn('href="styles.css"', html)
            self.assertIn('src="script.js"', html)
            self.assertIn(
                'href="https://doi.org/10.13865/j.cnki.cjbmb.2025.08.1219"',
                html,
            )
            self.assertIn('href="mailto:silele2004@163.com"', html)
            self.assertIn('href="https://github.com/zichenpku"', html)

    def test_metadata_and_semantics_exist(self) -> None:
        for page in PAGES:
            html = read_text(page)
            for token in (
                'rel="canonical"',
                'hreflang="en"',
                'hreflang="zh-CN"',
                'hreflang="x-default"',
                'property="og:title"',
                'type="application/ld+json"',
                'class="skip-link"',
                "data-menu-toggle",
                'aria-controls="site-nav"',
            ):
                self.assertIn(token, html, f"{page}: missing {token}")
            self.assertEqual(
                len(re.findall(r"<h1(?:\s|>)", html)),
                1,
                f"{page}: expected one h1",
            )

    def test_uhpb_photo_is_present_and_described_in_both_languages(self) -> None:
        image_path = ROOT / "assets" / "uhpb-poster.jpg"
        fallback_path = ROOT / "assets" / "uhpb-poster.b64"
        self.assertTrue(image_path.is_file())
        self.assertEqual(
            hashlib.sha256(image_path.read_bytes()).hexdigest(),
            "e1bda02f359bcacf03d7b574c8c27772dfeb0ba6c46d4e146531418bbe2349cc",
        )
        self.assertTrue(fallback_path.is_file())
        self.assertEqual(
            hashlib.sha256(base64.b64decode(fallback_path.read_text())).hexdigest(),
            "e1bda02f359bcacf03d7b574c8c27772dfeb0ba6c46d4e146531418bbe2349cc",
        )
        english = read_text("index.html")
        chinese = read_text("zh.html")
        self.assertIn('src="assets/uhpb-poster.jpg"', english)
        self.assertIn('data-poster-fallback="assets/uhpb-poster.b64"', english)
        self.assertIn(
            'alt="Zichen Zhang presenting the Repli-HiC poster at the UHPB Annual Meeting"',
            english,
        )
        self.assertIn('src="assets/uhpb-poster.jpg"', chinese)
        self.assertIn('data-poster-fallback="assets/uhpb-poster.b64"', chinese)
        self.assertIn(
            'alt="张梓宸在UHPB年会展示Repli-HiC研究墙报"',
            chinese,
        )
        script = read_text("script.js")
        self.assertIn("[data-poster-fallback]", script)
        self.assertIn("data:image/jpeg;base64,", script)


if __name__ == "__main__":
    unittest.main()

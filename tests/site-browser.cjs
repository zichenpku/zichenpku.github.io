const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
let server;
let browser;
let baseUrl;

test.before(async () => {
  server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const relativePath =
      requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      const type = filePath.endsWith(".css")
        ? "text/css"
        : filePath.endsWith(".js")
          ? "text/javascript"
          : "text/html";
      response.writeHead(200, { "content-type": type });
      response.end(content);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.SITE_BROWSER_EXECUTABLE;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("applies the approved A2 visual foundation in a real browser", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  await page.goto(`${baseUrl}/tests/fixtures/shared.html`);
  const visual = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const shellStyle = getComputedStyle(document.querySelector(".site-shell"));
    const heroStyle = getComputedStyle(document.querySelector(".hero"));
    return {
      accent: rootStyle.getPropertyValue("--color-accent").trim(),
      shellBackground: shellStyle.backgroundColor,
      heroDisplay: heroStyle.display,
    };
  });
  assert.deepEqual(visual, {
    accent: "#8f1d22",
    shellBackground: "rgb(255, 255, 255)",
    heroDisplay: "grid",
  });
  await page.close();
});

test("keeps navigation visible when JavaScript is disabled", async () => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tests/fixtures/shared.html`);
  assert.equal(
    await page
      .locator("[data-site-nav]")
      .evaluate((node) => getComputedStyle(node).display),
    "flex",
  );
  assert.equal(
    await page
      .locator("[data-menu-toggle]")
      .evaluate((node) => getComputedStyle(node).display),
    "none",
  );
  await context.close();
});

test("opens and closes the mobile menu with pointer and keyboard input", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await page.goto(`${baseUrl}/tests/fixtures/shared.html`);
  const button = page.locator("[data-menu-toggle]");
  const nav = page.locator("[data-site-nav]");
  await button.click();
  assert.equal(await button.getAttribute("aria-expanded"), "true");
  assert.equal(await nav.getAttribute("data-open"), "true");
  await page.locator("[data-site-nav] a").first().click();
  assert.equal(await button.getAttribute("aria-expanded"), "false");
  await button.click();
  await page.keyboard.press("Escape");
  assert.equal(await button.getAttribute("aria-expanded"), "false");
  assert.equal(
    await button.evaluate((node) => node === document.activeElement),
    true,
  );
  assert.notEqual(
    await page.locator("[data-current-year]").textContent(),
    "1900",
  );
  await page.close();
});

test("switches between complete English and Chinese pages", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  await page.goto(`${baseUrl}/index.html`);
  await page.locator(".language-link").click();
  await page.waitForURL(`${baseUrl}/zh.html`);
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.match(await page.locator("h1").textContent(), /张梓宸/);
  await page.locator(".language-link").click();
  await page.waitForURL(`${baseUrl}/index.html`);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  await page.close();
});

test("shows three concise personal honors in both languages", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  const pages = [
    {
      path: "index.html",
      heading: "Honors",
      award: "Outstanding Research Award",
      meta: "Peking University · 2025-2026",
    },
    {
      path: "zh.html",
      heading: "个人荣誉",
      award: "北京大学优秀科研奖",
      meta: "北京大学 · 2025至2026学年",
    },
  ];

  for (const pageSpec of pages) {
    await page.goto(`${baseUrl}/${pageSpec.path}`);
    const section = page.locator("#awards");
    assert.equal(await section.locator("h2").textContent(), pageSpec.heading);
    assert.equal(await section.locator(".award-card").count(), 3);

    const researchAward = section
      .locator(".award-card")
      .filter({ hasText: pageSpec.award });
    assert.equal(await researchAward.count(), 1);
    assert.match(await researchAward.textContent(), new RegExp(pageSpec.meta));
    assert.equal(await researchAward.locator("h3, p").count(), 0);
    assert.equal(await section.locator(".awards-grid p").count(), 0);

    const columns = await section.locator(".awards-grid").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(" ").length,
    );
    assert.equal(columns, 3);
  }

  await page.close();
});

test("visually distinguishes the selected cancer-project output", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });

  for (const pagePath of ["index.html", "zh.html"]) {
    await page.goto(`${baseUrl}/${pagePath}`);
    const output = page.locator(".selected-output");
    assert.equal(await output.count(), 1);
    const visual = await output.evaluate((node) => {
      const style = getComputedStyle(node);
      const parentStyle = getComputedStyle(node.closest(".card"));
      return {
        background: style.backgroundColor,
        parentBackground: parentStyle.backgroundColor,
        borderWidth: Number.parseFloat(style.borderLeftWidth),
        outputFontSize: Number.parseFloat(
          getComputedStyle(node.querySelector("p")).fontSize,
        ),
        bodyFontSize: Number.parseFloat(
          getComputedStyle(node.closest(".card").querySelector(":scope > p")).fontSize,
        ),
      };
    });
    assert.notEqual(visual.background, visual.parentBackground);
    assert.ok(visual.borderWidth >= 3);
    assert.ok(visual.outputFontSize < visual.bodyFontSize);
  }

  await page.close();
});

test("keeps the UCHB output nested under the cancer project", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  const pages = [
    {
      path: "index.html",
      title: /Clinical and Multi-omic Study of Postoperative Intra-abdominal Infection/,
    },
    {
      path: "zh.html",
      title: /胃肠道肿瘤术后腹腔感染的临床与多组学研究/,
    },
  ];

  for (const pageSpec of pages) {
    await page.goto(`${baseUrl}/${pageSpec.path}`);
    const parentTitle = await page
      .locator(".selected-output")
      .evaluate((node) => node.closest(".card").querySelector("h3").textContent);
    assert.match(parentTitle, pageSpec.title);
  }

  await page.close();
});

test("preserves the nonsignificant permutation result in both languages", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  const pages = [
    {
      path: "index.html",
      project: "Short-term seizure forecasting from scalp EEG",
      limit: /permutation test was not statistically significant/,
    },
    {
      path: "zh.html",
      project: "基于头皮脑电的癫痫发作短期预测",
      limit: /置换检验尚未达到统计学显著性/,
    },
  ];

  for (const pageSpec of pages) {
    await page.goto(`${baseUrl}/${pageSpec.path}`);
    const card = page.locator(".card").filter({ hasText: pageSpec.project });
    assert.equal(await card.count(), 1);
    assert.match(await card.textContent(), pageSpec.limit);
  }

  await page.close();
});

test("updates localized mobile-menu labels as state changes", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await page.goto(`${baseUrl}/index.html`);
  const englishButton = page.locator("[data-menu-toggle]");
  assert.equal(await englishButton.getAttribute("aria-label"), "Open navigation");
  await englishButton.click();
  assert.equal(await englishButton.getAttribute("aria-label"), "Close navigation");
  await page.keyboard.press("Escape");
  assert.equal(await englishButton.getAttribute("aria-label"), "Open navigation");

  await page.goto(`${baseUrl}/zh.html`);
  const chineseButton = page.locator("[data-menu-toggle]");
  assert.equal(await chineseButton.getAttribute("aria-label"), "打开导航菜单");
  await chineseButton.click();
  assert.equal(await chineseButton.getAttribute("aria-label"), "关闭导航菜单");
  await page.keyboard.press("Escape");
  assert.equal(await chineseButton.getAttribute("aria-label"), "打开导航菜单");
  await page.close();
});

test("renders both pages without horizontal overflow at release viewports", async () => {
  const viewports = [
    { width: 1440, height: 1000, name: "desktop" },
    { width: 820, height: 1180, name: "tablet" },
    { width: 390, height: 844, name: "mobile" },
    { width: 320, height: 720, name: "narrow" },
  ];
  const pages = [
    { path: "index.html", name: "en" },
    { path: "zh.html", name: "zh" },
  ];

  for (const pageSpec of pages) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/${pageSpec.path}`);
      await page.locator(".hero-photo img").waitFor({ state: "visible" });
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        imageWidth: document.querySelector(".hero-photo img").naturalWidth,
        posterImageWidth:
          document.querySelector(".poster-figure img").naturalWidth,
      }));
      assert.ok(
        metrics.content <= metrics.viewport,
        `${pageSpec.name}/${viewport.name}: ${metrics.content}px exceeds ${metrics.viewport}px`,
      );
      assert.ok(
        metrics.imageWidth > 0,
        `${pageSpec.name}/${viewport.name}: profile image did not load`,
      );
      assert.ok(
        metrics.posterImageWidth > 0,
        `${pageSpec.name}/${viewport.name}: poster image did not load`,
      );
      if (process.env.SITE_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(
            process.env.SITE_SCREENSHOT_DIR,
            `${pageSpec.name}-${viewport.name}.png`,
          ),
          fullPage: true,
        });
      }
      await page.close();
    }
  }
});

test("loads the UHPB poster photograph and its localized caption", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.goto(`${baseUrl}/index.html`);
  const englishFigure = page.locator(".poster-figure");
  await englishFigure.scrollIntoViewIfNeeded();
  assert.ok(
    (await englishFigure.locator("img").evaluate((node) => node.naturalWidth)) > 0,
  );
  assert.match(
    await englishFigure.locator("figcaption").textContent(),
    /UHPB Annual Meeting · October 2025/,
  );
  if (process.env.SITE_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.SITE_SCREENSHOT_DIR, { recursive: true });
    await englishFigure.screenshot({
      path: path.join(process.env.SITE_SCREENSHOT_DIR, "en-poster-detail.png"),
    });
  }

  await page.goto(`${baseUrl}/zh.html`);
  const chineseFigure = page.locator(".poster-figure");
  await chineseFigure.scrollIntoViewIfNeeded();
  assert.ok(
    (await chineseFigure.locator("img").evaluate((node) => node.naturalWidth)) > 0,
  );
  assert.match(
    await chineseFigure.locator("figcaption").textContent(),
    /UHPB年会 · 2025年10月/,
  );
  if (process.env.SITE_SCREENSHOT_DIR) {
    await chineseFigure.screenshot({
      path: path.join(process.env.SITE_SCREENSHOT_DIR, "zh-poster-detail.png"),
    });
  }
  await page.close();
});

test("restores the poster from its text fallback when the JPEG is unavailable", async () => {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.route("**/assets/uhpb-poster.jpg", (route) => route.abort());
  await page.goto(`${baseUrl}/index.html`);
  await page.waitForFunction(() => {
    const image = document.querySelector("[data-poster-fallback]");
    return image?.src.startsWith("data:image/jpeg;base64,") &&
      image.naturalWidth > 0;
  });

  const image = page.locator("[data-poster-fallback]");
  const link = image.locator("xpath=ancestor::a");
  assert.match(await image.getAttribute("src"), /^data:image\/jpeg;base64,/);
  assert.match(await link.getAttribute("href"), /^data:image\/jpeg;base64,/);
  await page.close();
});

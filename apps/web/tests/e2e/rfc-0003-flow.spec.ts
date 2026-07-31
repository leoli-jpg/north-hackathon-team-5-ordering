import { expect, test } from "@playwright/test";

test("RFC-0003 纯 Mock 六步主流程可完整运行并查看备选方案", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /菜单不用翻半天/ })).toBeVisible();
  await page.getByRole("link", { name: /开始一次聚餐/ }).click();
  await expect(page.getByRole("heading", { name: "创建一次聚餐" })).toBeVisible();

  await page.getByLabel("聚餐名称").fill("RFC-0003 端到端测试聚餐");
  await page.getByRole("button", { name: /创建并上传菜单/ }).click();
  await expect(page.getByRole("heading", { name: "上传菜单", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "菜单第 1 页" })).toBeVisible();
  await expect(page.getByText("纯 Mock", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /开始识别菜单/ }).click();
  await expect(page.getByRole("heading", { name: "校正菜单" })).toBeVisible();
  await expect(page.getByText("价格缺失", { exact: true })).toBeVisible();
  await expect(page.getByText(/低置信 · 待确认/)).toBeVisible();

  await page.getByLabel("香辣鸡丁拌面价格（元）").fill("49");
  await expect(page.getByText("菜单已达到推荐质量门")).toBeVisible();
  await page.getByRole("button", { name: /确认菜单并填写成员需求/ }).click();
  await expect(page.getByRole("heading", { name: "每个人都想吃什么？" })).toBeVisible();
  await expect(page.getByText("小林", { exact: true })).toBeVisible();
  await expect(page.getByText("阿晨", { exact: true })).toBeVisible();
  await expect(page.getByText("周叔", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /确认成员并设置预算/ }).click();
  await expect(page.getByRole("heading", { name: "预算与优惠" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("RFC-0003 端到端测试聚餐", { exact: true })).toBeVisible();

  await page.getByLabel("总预算（元）").fill("220");
  await page.getByRole("button", { name: /保存并生成推荐/ }).click();

  await expect(page.getByRole("heading", { name: "推荐结果" })).toBeVisible();
  await expect(page.getByText("均衡共享方案", { exact: true })).toBeVisible();
  await expect(page.getByText(/避开花生过敏风险/)).toBeVisible();
  await expect(page.getByText("清爽时蔬沙拉", { exact: true })).toBeVisible();
  await expect(page.getByText("价格明细校验通过")).toBeVisible();

  await page.getByTestId("alternative-alt-budget").getByRole("button", { name: "查看并采用 →" }).click();
  await expect(page.getByText(/已选择“更省预算”作为当前演示备选/)).toBeVisible();
  await expect(page.getByRole("link", { name: "修改预算" })).toBeVisible();
});

test("预算不足时展示可操作冲突视图并可提高预算恢复", async ({ page }) => {
  await page.goto("/session/conflict-demo/menu");
  await page.getByRole("button", { name: /开始识别菜单/ }).click();
  await page.getByLabel("香辣鸡丁拌面价格（元）").fill("49");
  await page.getByRole("button", { name: /确认菜单并填写成员需求/ }).click();
  await page.getByRole("button", { name: /确认成员并设置预算/ }).click();
  await expect(page.getByLabel("总预算（元）")).toHaveValue("120");
  await page.getByRole("button", { name: /保存并生成推荐/ }).click();

  await expect(page.getByRole("heading", { name: "当前条件下没有可行方案" })).toBeVisible();
  await expect(page.getByText(/预算还差/)).toBeVisible();
  await expect(page.getByText(/硬过敏约束不提供/)).toBeVisible();

  await page.getByRole("button", { name: /把预算提高到 ¥220/ }).click();
  await expect(page.getByRole("heading", { name: "推荐结果" })).toBeVisible();
  await expect(page.getByText("均衡共享方案", { exact: true })).toBeVisible();
});

test("严重过敏必须二次确认，不能直接进入预算", async ({ page }) => {
  await page.goto("/session/allergy-demo/menu");
  await page.getByRole("button", { name: /开始识别菜单/ }).click();
  await page.getByLabel("香辣鸡丁拌面价格（元）").fill("49");
  await page.getByRole("button", { name: /确认菜单并填写成员需求/ }).click();

  await page.getByLabel("小林自然语言需求").fill("花生严重过敏，请完全避免花生。");
  await page.getByTestId("member-member-1").getByRole("button", { name: "✦ 解析需求" }).click();
  await expect(page.getByText("严重过敏：花生", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /确认成员并设置预算/ }).click();
  await expect(page.getByRole("alert")).toContainText("请先完成严重过敏二次确认");

  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.getByRole("button", { name: /确认成员并设置预算/ }).click();
  await expect(page.getByRole("heading", { name: "预算与优惠" })).toBeVisible();
});

test("移动端首页和上传页保持单列且没有横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /菜单不用翻半天/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/session/mobile-demo/menu");
  await expect(page.getByLabel(/当前第 2 步，共 6 步/)).toBeVisible();
  await expect(page.getByRole("button", { name: /开始识别菜单/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

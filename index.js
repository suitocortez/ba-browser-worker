import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  const { refnr } = req.body;

  if (!refnr) {
    return res.status(400).json({ error: "refnr fehlt" });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.goto(
      `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`,
      { timeout: 30000 }
    );

    await page.waitForSelector("a[href^='mailto:']", { timeout: 20000 });

    const email = await page
      .locator("a[href^='mailto:']")
      .first()
      .textContent();

    await browser.close();

    res.json({ refnr, email });
  } catch (err) {
    await browser.close();
    res.status(500).json({ error: "Extraktion fehlgeschlagen" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Browser Worker läuft auf Port ${PORT}`);
});

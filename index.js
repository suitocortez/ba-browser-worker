import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post("/extract", async (req, res) => {
  const { refnr } = req.body;

  if (!refnr) {
    return res.status(400).json({ error: "refnr fehlt" });
  }

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    const url = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`;
    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });

    // Warten bis Seite wirklich da ist
    await page.waitForTimeout(3000);

    // Gesamten sichtbaren Text einsammeln
    const result = await page.evaluate(() => {
      const text = document.body.innerText;

      // 🔒 Captcha erkennen
      const hasCaptcha =
        text.includes("Sicherheitsabfrage") ||
        text.includes("Dargestellte Zeichen") ||
        text.includes("Bitte geben Sie die dargestellten Zeichen ein");

      if (hasCaptcha) {
        return {
          protected: true,
          reason: "captcha",
          contact: null
        };
      }

      // 📧 E-Mail extrahieren
      const emailMatch = text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      );

      // ☎ Telefonnummer extrahieren
      const phoneMatch = text.match(
        /(\+49|0)[0-9 ()\/-]{6,}/
      );

      // 👤 Ansprechpartner (heuristisch)
      let name = null;
      const nameMatch = text.match(
        /(Herr|Frau)\s+[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+/
      );
      if (nameMatch) {
        name = nameMatch[0];
      }

      return {
        protected: false,
        contact: {
          name: name,
          email: emailMatch ? emailMatch[0] : null,
          phone: phoneMatch ? phoneMatch[0] : null
        }
      };
    });

    await browser.close();

    return res.json({
      refnr,
      result
    });

  } catch (err) {
    if (browser) await browser.close();

    console.error("❌ Extraktion Fehler:", err.message);

    return res.status(500).json({
      refnr,
      error: "Extraktion fehlgeschlagen",
      details: err.message
    });
  }
});

app.get("/", (_, res) => {
  res.send("BA Browser Worker läuft");
});

app.listen(PORT, () => {
  console.log(`Browser Worker läuft auf Port ${PORT}`);
});

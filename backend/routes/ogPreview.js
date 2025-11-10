// c express from "express";
// import axios from "axios";
// import * as cheerio from "cheerio";
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

router.get("/", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // Fetch the HTML content
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    // Extract Open Graph and meta tags
    const ogTitle = $('meta[property="og:title"]').attr("content") || $("title").text();
    const ogDescription =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";
    const ogImage = $('meta[property="og:image"]').attr("content") || "";
    const ogUrl = $('meta[property="og:url"]').attr("content") || url;

    res.json({
      success: true,
      data: {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        url: ogUrl,
      },
    });
  } catch (error) {
    console.error("Error fetching OG data:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch OG data" });
  }
});

module.exports = router;

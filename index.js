const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const { createProxyMiddleware } = require("http-proxy-middleware");
const API_SERVICE_URL = "https://web.opendrive.com";
const axios = require("axios");

const archive = require("./generators/archive");
const waveform = require("./generators/waveform");
const fileinfo = require("./generators/fileinfo");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.options(process.env.CORS || "*", cors());

app.use(
  "/proxy",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      const splitted = path?.split("/");
      const lastpart = splitted?.[splitted?.length - 1];
      if (lastpart?.includes(".") && lastpart?.split(".")?.length >= 2) {
        return splitted
          .slice(0, splitted.length - 1)
          .join("/")
          .replace("/proxy", "/api/v1/download/file.json/");
      } else {
        return path.replace("/proxy", "/api/v1/download/file.json/");
      }
    },
  })
);

app.use(
  "/download",
  createProxyMiddleware({
    target: process.env.POCKETBASE_URL,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      const splitted = path?.split("/");
      req.originalPath = path;
      return path.replace("/download", "/api/files")?.split("/")?.slice(0, 6)?.join("/");
    },
    onProxyRes: async function (proxyRes, req, res) {
      const path = req?.originalPath?.split("/");
      if (path?.length === 6) {
        const newname = path?.[path?.length - 1];
        delete proxyRes.headers["content-disposition"];
        proxyRes.headers["content-disposition"] = "attachment; filename=" + newname;
      } else {
        const filename = proxyRes.headers["content-disposition"]?.split("filename=")?.[1];
        delete proxyRes.headers["content-disposition"];
        const extension = filename?.split(".")?.[filename?.split(".")?.length - 1];
        const name = filename?.substring(0, filename?.length - extension?.length - 1);
        let newname = name?.split("_")?.slice(0, -1)?.join("_") + "." + extension;

        proxyRes.headers["content-disposition"] = "attachment; filename=" + newname;
      }
    },
  })
);

app.get("/api/read-archive", archive);
app.get("/api/read-audio", waveform);
app.post("/api/file-info", fileinfo);

app.listen(process.env.PORT || 4000, () => {
  console.log(`🚀 stream server ready on port ${process.env.PORT || 4000}`);
});

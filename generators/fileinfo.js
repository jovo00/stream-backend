const url = require("url");
const { http, https } = require("follow-redirects");

const isUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = async (req, res) => {
  let inputurl = req?.body?.url;
  if (!inputurl || inputurl === "" || !isUrl(inputurl)) {
    res.status(400).send({ message: "Bad Request. Missing URL" });
    return;
  }
  if (inputurl?.includes("drive.google.com/file/d/")) {
    const fileid = inputurl.split("/")[5];
    const driveurl = `https://drive.google.com/uc?id=${fileid}&export=download`;
    inputurl = driveurl;
  }
  const options = url.parse(inputurl);
  let fileinfo = new Promise((resolve, reject) => {
    const client = options.protocol === "https:" ? https : http;
    const request = client.request(options, (res) => {
      const headers = res.headers;

      const size = parseFloat(headers?.["content-length"] || 0);

      const filename = decodeURIComponent(
        headers?.["content-disposition"]
          ?.replaceAll("*", "")
          ?.replaceAll("UTF-8''", "")
          ?.replaceAll('"', "")
          ?.replaceAll(";", "")
          ?.split("filename=")[1] || ""
      );

      resolve({
        title: filename?.split(".")?.[filename?.split(".")?.length - 2]?.trim(),
        type:
          filename?.split(".")?.pop()?.toLowerCase() === "" ? null : filename?.split(".")?.pop()?.toLowerCase()?.trim(),
        size,
        url: inputurl?.trim(),
      });
    });
    request.end();
  });

  if (fileinfo) {
    res.status(200).send(await fileinfo);
  } else {
    res.status(404).send({ message: "File not found" });
  }
};

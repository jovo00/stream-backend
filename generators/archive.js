const axios = require("axios");
const request = require("request");
const unzipper = require("unzipper");
const getFileUrl = require("../util/fileurl");

module.exports = async function (req, res) {
  const auth = req.headers.authorization;
  const file = req.query.file;
  const maxFiles = 250;
  const maxSize = 1024 * 1024 * 1024 * 10;

  //   if (!auth) {
  //     res.status(401).send("Unauthorized");
  //     return;
  //   }

  if (!file) {
    res.status(400).send("Bad Request. Missing File ID");
    return;
  }

  const url = process.env.POCKETBASE_URL + "/api/collections/files/records/" + file;

  try {
    const response = await axios.get(url, {
      headers: {
        ...(auth && { Authorization: auth }),
      },
    });

    if (response.status !== 200) {
      res.status(response.status).send(response.statusText);
      return;
    }

    const data = response.data;

    if (data?.size > maxSize) {
      res.status(400).send("Bad Request. File is too large");
      return;
    }

    if (data?.type !== "zip" || !(data?.file_url || data?.file)) {
      res.status(400).send("Bad Request. File is not an archive");
      return;
    }

    const directory = await unzipper.Open.url(request, data?.file ? getFileUrl(data, "file") : data?.file_url);
    const files = directory?.files?.map((file) => {
      return {
        path: file.path,
        type: file.type,
        size: file.uncompressedSize,
      };
    });

    if (files?.length >= maxFiles) {
      res.status(400).send("Bad Request. Archive contains too many files");
    }

    if (files) {
      res.send(files);
    } else {
      res.status(404).send("Not found");
    }

    try {
      const admin = await axios.post(process.env.POCKETBASE_URL + "/api/admins/auth-with-password", {
        identity: process.env.POCKETBASE_ADMIN,
        password: process.env.POCKETBASE_PASS,
      });
      const token = admin?.data?.token;

      if (token) {
        await axios.post(
          `${process.env.POCKETBASE_URL}/api/collections/filepreviews/records`,
          {
            type: "archive",
            file: data?.id,
            data: files ? JSON.stringify(files) : null,
          },
          {
            headers: {
              Authorization: token,
            },
          }
        );
      }
    } catch (error) {
      console.log("Could not save preview for File " + data?.id);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

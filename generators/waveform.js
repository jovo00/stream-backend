const axios = require("axios");
const getFileUrl = require("../util/fileurl");
const { decodeAudioData } = require("./audio-decode");

module.exports = async function (req, res) {
  const auth = req.headers.authorization;
  const file = req.query.file;
  const maxSize = 1024 * 1024 * 100;

  if (!auth) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (!file) {
    res.status(400).send("Bad Request. Missing File ID");
    return;
  }

  const url = process.env.POCKETBASE_URL + "/api/collections/files/records/" + file;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: auth,
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

    if (!["mp3", "wav"]?.includes(data?.type) || !(data?.file_url || data?.file)) {
      res.status(400).send("Bad Request. File is not an audio file");
      return;
    }

    const audio = await axios.get(data?.file ? getFileUrl(data, "file") : data?.file_url, {
      responseType: "arraybuffer",
    });

    // get size of audio file
    const size = audio?.data?.byteLength;
    if (size > maxSize) {
      res.status(400).send("Bad Request. File is too large");
      return;
    }

    const arrayBuffer = audio?.data;
    const audioBuffer = await decodeAudioData(arrayBuffer);

    const rawData = audioBuffer.getChannelData(0);
    const samples = 350;
    const blockSize = Math.floor(rawData.length / samples);
    let waveData = [];
    for (let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum = sum + Math.abs(rawData[blockStart + j]);
      }
      waveData.push(sum / blockSize);
    }
    const multiplier = Math.pow(Math.max(...waveData), -1);
    waveData = waveData.map((n) => (n * multiplier).toFixed(4));

    if (waveData) {
      res.send(waveData);
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
            type: "waveform",
            file: data?.id,
            data: waveData ? JSON.stringify(waveData) : null,
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
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

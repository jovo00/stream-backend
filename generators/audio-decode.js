const prism = require('prism-media');
const FFMPEG_ARGUMENTS = (sampleRate, channels) => ['-analyzeduration', '0', '-loglevel', '0', '-f', 'f32le', '-ar', String(sampleRate), '-ac', String(channels)];
const { Readable } = require('stream');
const { types } = require('util');

function decodeAudioData(data, { sampleRate = 48000, numberOfChannels = 2 } = {}) {
  const type = (data instanceof Buffer || types.isUint8Array(data)) ? 'buffer' : (data && typeof data.pipe === 'function') ? 'stream' : 'invalid';
  if (type === 'invalid') return Promise.reject(new TypeError('input must be a readable stream'));
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1) return Promise.reject(new TypeError('sampleRate must be a positive integer'));
  if (!Number.isSafeInteger(numberOfChannels) || numberOfChannels < 1) return Promise.reject(new TypeError('numberOfChannels must be a positive integer'));
  const ffmpeg = new prism.FFmpeg({
    args: FFMPEG_ARGUMENTS(sampleRate, numberOfChannels),
  });
  const result = new Promise(resolve => {
    const buffers = [];
    ffmpeg.on('data', buffer => buffers.push(buffer));
    ffmpeg.on('error', console.error);
    ffmpeg.on('end', () => {
      const buffer = new Float32Array(Buffer.concat(buffers).buffer);
      const length = buffer.length / numberOfChannels;
      const data = [...new Array(numberOfChannels)].map(() => new Float32Array(length));
      buffer.forEach((value, index) => {
        data[index % numberOfChannels][Math.floor(index / numberOfChannels)] = value;
      });
      resolve(
        new AudioBuffer({
          sampleRate,
          length,
          data,
        })
      );
    });
  });
  if (type === 'stream') {
    data.pipe(ffmpeg);
  } else {
    ffmpeg.write(data);
    ffmpeg.end();
  }
  return result;
}

function decodeAudioDataStream(data, { sampleRate = 48000, numberOfChannels = 1 } = {}) {
  const type = data && typeof data.pipe === 'function' ? 'stream' : 'invalid';
  if (type === 'invalid') throw new TypeError('input must be a readable stream');
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1) throw new TypeError('sampleRate must be a positive integer');
  if (!Number.isSafeInteger(numberOfChannels) || numberOfChannels < 1) throw new TypeError('numberOfChannels must be a positive integer');
  const ffmpeg = new prism.FFmpeg({
    args: FFMPEG_ARGUMENTS(sampleRate, numberOfChannels),
  });
  ffmpeg.on('data', buffer => stream.push(buffer))
  ffmpeg.on('end', () => stream.push(null))
  const stream = new (class extends Readable {
    _read() {}
  })();
  data.pipe(ffmpeg);
  return stream;
}

class AudioBuffer {
  #_data;
  constructor(d) {
    const { sampleRate, length, data } = d;
    Object.defineProperties(this, {
      sampleRate: { value: sampleRate, enumerable: true },
      length: { value: length, enumerable: true },
      duration: { value: length / sampleRate, enumerable: true },
      numberOfChannels: { value: data.length, enumerable: true },
    });
    this.#_data = data;
  }
  getChannelData(channel) {
    return this.#_data[channel];
  }
  copyFromChannel(destination, channelNumber, startInChannel = 0) {
    destination.set(this.#_data[channelNumber].slice(startInChannel));
  }
  copyToChannel(source, channelNumber, startInChannel = 0) {
    this.#_data[channelNumber].set(source, startInChannel);
  }
}

module.exports = {
  decodeAudioData,
  decodeAudioDataStream,
};

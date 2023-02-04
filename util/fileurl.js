module.exports = (file, key, thumb) => {
  if (file?.[key]) {
    return `${process.env.POCKETBASE_URL}/api/files/${file?.collectionId}/${file?.id}/${file?.[key]}${
      thumb ? "?thumb=" + thumb : ""
    }`;
  } else {
    return null;
  }
};

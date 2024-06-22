// chrome.contextMenus.onClicked.addListener(function (info, tab) {
//   chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//     chrome.tabs.sendMessage(tabs[0].id, { data: info });
// });

const SERVER_URL = "http://localhost:8080";

const makeRequest = async (url, method, payload, additionalHeaders) => {
  const headers =
    method === "POST"
      ? {
          "Content-Type": "application/json",
          ...additionalHeaders,
        }
      : { ...additionalHeaders };
  return new Promise(async (res, rej) => {
    const response = await fetch(url, {
      method,
      body: payload,
      headers,
      credentials: "include",
    });
    if (response.status >= 400 && response.status <= 500) {
      rej(await response.json());
      return;
    }
    const data = await response.json();

    res(data);
  });
};

async function getCookie() {
  const COOKIE_NAME = "google-auth-token";

  return new Promise((res) => {
    chrome.cookies.get(
      { url: SERVER_URL, name: COOKIE_NAME },
      function (cookie) {
        if (cookie) {
          res(cookie.value);
        } else {
          res("");
        }
      },
    );
  });
}

function createContextMenus(data) {
  chrome.contextMenus.create({
    title: "MoveToDoc",
    id: "move-to-doc",
    contexts: ["all"],
  });
  data.forEach((d, i) => {
    chrome.contextMenus.create({
      title: d.title,
      id: d.documentId,
      parentId: "move-to-doc",
      contexts: ["all"],
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  const cookie = await getCookie();
  if (cookie) {
    try {
      const data = await makeRequest(
        `${SERVER_URL}/list-docs`,
        "POST",
        decodeURIComponent(cookie),
      );
      createContextMenus(data);
    } catch (e) {}
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log(info, tab);
  const { menuItemId, frameUrl, selectionText } = info;
  const cookie = await getCookie();

  console.log(info, tab);
  try {
    const data = await makeRequest(
      `${SERVER_URL}/append-to-doc`,
      "POST",
      JSON.stringify({
        docId: menuItemId,
        sourceUrl: frameUrl,
        selectionText,
        ...JSON.parse(decodeURIComponent(cookie)),
      }),
    );
  } catch (e) {
    console.error("ERROR");
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendMessage) => {
  await chrome.contextMenus.removeAll();
  if (Array.isArray(message)) {
    createContextMenus(message);
  }
});

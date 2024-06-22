const SERVER_URL = "http://localhost:8080";

function getGoogleAuthURL() {
  const CLIENT_ID = "733584878721-pfvg1kv047ujg7r3ko2b8j565klducj9";
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: SERVER_URL,
    client_id: CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
}

const sendMessageToBg = (payload) => {
  console.log(payload);
  chrome.runtime.sendMessage(payload);
};

const makeRequest = async (url, method, payload, additionalHeaders) => {
  const headers =
    method === "POST"
      ? {
          "Content-Type": "application/json",
          ...additionalHeaders,
        }
      : { ...additionalHeaders };
  return new Promise(async (res, rej) => {
    try {
      const response = await fetch(url, {
        method,
        body: payload,
        headers,
        credentials: "include",
      });

      try {
        if (response.status >= 400 && response.status <= 500) {
          rej(await response.json());
          return;
        }
        const data = await response.json();
        res(data);
      } catch (e) {
        switchLoader(false);
        alert("Unable to convert response to JSON. Please try again");
        console.log(e);
      }
    } catch (e) {
      switchLoader(false);
      alert("Unable to connect to server. Please try again");
    }
  });
};

function createFormInput(parent, cb, logoutCb) {
  const inputWrapperDiv = document.createElement("div");
  const submitWrapperDiv = document.createElement("div");
  const input = document.createElement("input");
  const submit = document.createElement("button");
  const logout = document.createElement("button");
  logout.setAttribute("id", "logoutButton");
  logout.innerText = "logout";
  inputWrapperDiv.setAttribute("id", "inputWrapperDiv");
  submitWrapperDiv.setAttribute("id", "submitWrapperDiv");
  input.setAttribute("placeholder", "Enter Document name to create");
  submit.setAttribute("id", "submitButton");
  submit.innerText = "submit";

  inputWrapperDiv.appendChild(input);
  inputWrapperDiv.appendChild(logout);
  submitWrapperDiv.appendChild(submit);

  parent.appendChild(inputWrapperDiv);
  parent.appendChild(submitWrapperDiv);

  submit.addEventListener("click", () => cb(input));
  logout.addEventListener("click", logoutCb);
  chrome.runtime.sendMessage("logout");
}

function createLi(title, href) {
  const li = document.createElement("li");
  li.setAttribute("class", "formLi");
  const a = document.createElement("a");
  a.setAttribute("href", href);
  a.setAttribute("target", "_blank");
  a.innerHTML = title;
  const input = document.createElement("input");
  input.setAttribute("type", "radio");
  input.setAttribute("value", title);
  input.setAttribute("name", title.toLowerCase());
  li.appendChild(a);

  return li;
}

function createFormList(data, ul, parent) {
  for (let i = 0; i < data.length; i++) {
    const li = createLi(data[i].title, data[i].href);

    ul.appendChild(li);
  }

  parent.appendChild(ul);
}

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

function switchLoader(bool) {
  const loaderDiv = document.getElementById("loader");
  loaderDiv.style.display = bool ? "block" : "none";
}

function transformData(data) {
  return data.map((d) => {
    return {
      title: d.title,
      href: d.docUrl,
    };
  });
}

async function main() {
  switchLoader(true);
  const cookie = await getCookie();
  switchLoader(false);
  const body = document.getElementById("body");

  if (cookie) {
    switchLoader(true);
    const data = await makeRequest(
      `${SERVER_URL}/list-docs`,
      "POST",
      decodeURIComponent(cookie),
    );
    switchLoader(false);

    const formWrapperDiv = document.createElement("div");
    formWrapperDiv.setAttribute("class", "formWrapper");
    body.appendChild(formWrapperDiv);

    const ol = document.createElement("ol");

    const callback = async function (input) {
      switchLoader(true);
      const data = await makeRequest(
        `${SERVER_URL}/create-doc`,
        "POST",
        JSON.stringify({
          docName: input.value,
          ...JSON.parse(decodeURIComponent(cookie)),
        }),
      );

      if (data.length === 1) {
        createFormList(transformData(data), ol, formWrapperDiv);
      } else {
        const transformedData = transformData(data);
        const li = createLi(
          transformedData[transformedData.length - 1].title,
          transformedData[transformedData.length - 1].href,
        );
        ol.appendChild(li);
      }
      sendMessageToBg(data);
      switchLoader(false);
    };

    const logoutCallback = async () => {
      switchLoader(true);
      await makeRequest(
        `${SERVER_URL}/logout`,
        "POST",
        decodeURIComponent(cookie),
      );
      switchLoader(false);
      window.close();
    };

    createFormInput(formWrapperDiv, callback, logoutCallback);

    if (data.length != 0) {
      createFormList(transformData(data), ol, formWrapperDiv);
    }
  } else {
    const googleAuthURL = getGoogleAuthURL();
    const button = document.createElement("button");
    button.setAttribute("id", "googleButton");

    const a = document.createElement("a");
    a.setAttribute("href", googleAuthURL);
    a.setAttribute("target", "_blank");
    a.innerText = "Google Login";
    a.style.textDecoration = "none";

    button.appendChild(a);

    body.appendChild(button);
  }
}

main();

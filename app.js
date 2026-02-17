(function () {
  const DECOMPILE_API = "https://lutetia-api-little-sea-4696.fly.dev/decompile";
  const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
  const DEFAULT_ETHERSCAN_APIKEY = "FY6KF9BZNV2E39UVHV6668CK96X6TBVT3W";

  const tabs = document.querySelectorAll(".tab");
  const panelAddress = document.getElementById("panel-address");
  const panelPaste = document.getElementById("panel-paste");
  const contractAddress = document.getElementById("contract-address");
  const chainSelect = document.getElementById("chain");
  const etherscanApikey = document.getElementById("etherscan-apikey");
  const bytecodePaste = document.getElementById("bytecode-paste");
  const btnDecompile = document.getElementById("btn-decompile");
  const statusEl = document.getElementById("status");
  const outputSection = document.getElementById("output-section");
  const outputCode = document.getElementById("output-code");
  const btnCopy = document.getElementById("btn-copy");

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (type ? " " + type : "");
  }

  function normalizeHex(hex) {
    if (!hex || typeof hex !== "string") return "";
    const s = hex.trim().replace(/^0x/i, "");
    return /^[0-9a-fA-F]+$/.test(s) ? s : "";
  }

  function getBytecodeFromPaste() {
    const raw = bytecodePaste.value.trim();
    const hex = normalizeHex(raw);
    return hex ? hex : null;
  }

  function getBytecodeFromEtherscan(address, chainId, apikey) {
    const addr = address.trim().replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{40}$/.test(addr)) return Promise.reject(new Error("Invalid contract address"));
    const params = new URLSearchParams({
      chainid: String(chainId),
      module: "proxy",
      action: "eth_getCode",
      address: "0x" + addr,
      tag: "latest",
    });
    if (apikey) params.set("apikey", apikey);
    const url = ETHERSCAN_V2 + "?" + params.toString();
    return fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return Promise.reject(new Error(data.error.message || "Etherscan error"));
        const code = data.result;
        if (!code || typeof code !== "string") return Promise.reject(new Error("No bytecode returned"));
        const hex = normalizeHex(code);
        if (!hex) return Promise.reject(new Error("Invalid bytecode from chain"));
        return hex;
      });
  }

  function decompile(bytecodeHex) {
    return fetch(DECOMPILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bytecode: bytecodeHex }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Decompile request failed: " + r.status);
        return r.text();
      })
      .then((text) => {
        try {
          return JSON.parse(text);
        } catch (_) {
          return { output: text };
        }
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        return data.output != null ? String(data.output) : "";
      });
  }

  function showOutput(code) {
    outputCode.textContent = code || "(no output)";
    outputSection.classList.remove("hidden");
    outputCode.parentElement.classList.remove("language-python");
    outputCode.parentElement.classList.add("language-python");
    hljs.highlightElement(outputCode);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const t = this.getAttribute("data-tab");
      tabs.forEach((x) => x.classList.remove("active"));
      this.classList.add("active");
      panelAddress.classList.toggle("active", t === "address");
      panelPaste.classList.toggle("active", t === "paste");
      setStatus("");
    });
  });

  btnDecompile.addEventListener("click", function () {
    setStatus("");
    const isAddress = document.querySelector(".tab.active").getAttribute("data-tab") === "address";

    let promise;
    if (isAddress) {
      const addr = contractAddress.value.trim();
      if (!addr) {
        setStatus("Enter a contract address.", "error");
        return;
      }
      setStatus("Fetching bytecode from chain…");
      promise = getBytecodeFromEtherscan(addr, chainSelect.value, etherscanApikey.value.trim() || DEFAULT_ETHERSCAN_APIKEY);
    } else {
      const hex = getBytecodeFromPaste();
      if (!hex) {
        setStatus("Paste valid hex bytecode.", "error");
        return;
      }
      promise = Promise.resolve(hex);
    }

    btnDecompile.disabled = true;
    promise
      .then((bytecodeHex) => {
        setStatus("Decompiling…");
        return decompile(bytecodeHex);
      })
      .then((result) => {
        setStatus("Done.", "success");
        showOutput(result);
      })
      .catch((err) => {
        setStatus(err.message || "Error", "error");
      })
      .finally(() => {
        btnDecompile.disabled = false;
      });
  });

  btnCopy.addEventListener("click", function () {
    const text = outputCode.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        const orig = btnCopy.textContent;
        btnCopy.textContent = "Copied";
        setTimeout(() => { btnCopy.textContent = orig; }, 1500);
      },
      () => {}
    );
  });
})();

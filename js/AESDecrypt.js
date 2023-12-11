let decryptionSuccess = false; // 新增的标志

async function AESDecrypt(cipher, password) {
    let parts = cipher.split("|");
    let ciphertext = parts[1];
    let nonce = parts[0];
    const ciphertextBuffer = hexToBytes(ciphertext)
    // 计算密码的 SHA-256作为密钥
    // 将密码转换为 Uint8Array
    let encoder = new TextEncoder();
    let data = encoder.encode(password);

    // 计算 SHA-256 哈希
    let hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // 将哈希结果转换为 Uint8Array
    let hash = Array.from(new Uint8Array(hashBuffer));

    const hashKey = new Uint8Array(hash);
    const key = await window.crypto.subtle.importKey(
        'raw',
        hashKey, {
        name: 'AES-GCM',
    },
        false,
        ['decrypt']
    )
    let iv = hexToBytes(nonce)
    const decrypted = await window.crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
    },
        key,
        new Uint8Array(ciphertextBuffer)
    )
    return new TextDecoder('utf-8').decode(new Uint8Array(decrypted))
}
function hexToBytes(hexString) {
    // 去除可能存在的前缀 "0x" 或 "0X"
    if (hexString.startsWith("0x") || hexString.startsWith("0X")) {
        hexString = hexString.slice(2);
    }

    // 将十六进制字符串转换为 Uint8Array
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }

    return bytes;
}
console.log("js load");
let title = document.title
if (localStorage.getItem(title)!== null) {
    decryption(localStorage.getItem(title))
}
const submitButton = document.getElementById('secret-submit');
submitButton.addEventListener('click', function (event) {
    event.preventDefault(); // Blocking the default form submission behavior
    checkPassword();
});

function checkPassword() {
    const passwordInput = document.querySelector('input[name="password"]');
    const password = passwordInput.value;
    decryption(password)
}
// 解密函数
async function decryption(password) {
    let secretElement = document.getElementById('secret');
    let ciphertext = secretElement.innerText;

    try {
        const plaintext = await AESDecrypt(ciphertext, password);

        document.getElementById("verification").style.display = "none";
        let verificationElement = document.getElementById('verification');
        let htmlText = marked.parse(plaintext);
        verificationElement.insertAdjacentHTML('afterend', htmlText);

        // 手动执行插入的 JavaScript 代码
        executeInsertedScripts(verificationElement);

        // 设置解密成功的标志
        decryptionSuccess = true;

        if (localStorage.getItem(title) !== password) localStorage.setItem(title, password);

        // 在所有解密成功后进行一次页面重载
        reloadPageIfNeeded();

    } catch (error) {
        alert("Incorrect password. Please try again.");
        console.error("Failed to decrypt", error);
    }
}

// 新增的检查是否重载页面的函数
function reloadPageIfNeeded() {
    if (decryptionSuccess) {
        location.reload(true); // 参数为 true 表示强制从服务器重新加载页面
    }
}

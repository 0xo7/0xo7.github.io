
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
function decryption(password) {
    let secretElement = document.getElementById('secret');
    let ciphertext = secretElement.innerText;

    AESDecrypt(ciphertext, password).then(plaintext => {
        document.getElementById("verification").style.display = "none";
        let verificationElement = document.getElementById('verification');
        let htmlText = marked.parse(plaintext);

        // 创建一个div元素，用于包裹解密后的HTML内容
        let wrapperDiv = document.createElement('div');
        wrapperDiv.innerHTML = htmlText;

        // 获取包裹的script元素
        let scriptElements = wrapperDiv.querySelectorAll('script');

        // 遍历script元素，将其内容插入到页面并执行
        scriptElements.forEach(script => {
            let newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            document.head.appendChild(newScript).parentNode.removeChild(newScript);
        });

        // 将包裹的HTML内容插入到页面中
        verificationElement.insertAdjacentElement('afterend', wrapperDiv);

        // 如果密码正确，将密码存储到本地存储中
        if (localStorage.getItem(title) !== password) localStorage.setItem(title, password);
    }).catch(error => {
        alert("Incorrect password. Please try again.");
        console.error("Failed to decrypt", error);
    });
}

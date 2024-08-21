function initImage() {
    console.log("load initImage.js");

    // 获取所有 img 元素
    const images = document.querySelectorAll('img');

    images.forEach((item) => {
        // 处理 src 属性
        let src = item.getAttribute('src');
        if (src) {
            let imageName = src.match(/image-\d+\.(png|jpg|jpeg|gif)/i); // 提取文件名
            if (imageName) {
                item.setAttribute('src', imageName[0]);
            }
        }
    });
}

// 使用 DOMContentLoaded 事件
document.addEventListener('DOMContentLoaded', () => {
    initImage();
});

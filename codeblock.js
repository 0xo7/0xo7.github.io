window.onload = function() {
    const highlightElements = document.getElementsByClassName('highlight');
    const lntdHeights = [];
    const numLinesArray = [];
    const maxHeights = [];

    Array.from(highlightElements).forEach((highlightElement)=>{
        var spanElements = highlightElement ? highlightElement.querySelectorAll('span.lnt') : null;

        if (spanElements && spanElements.length > 0) {
            var startSpanIndex = 0;
            var endSpanIndex = 19;

            if (startSpanIndex < spanElements.length && endSpanIndex < spanElements.length) {
                var startSpan = spanElements[startSpanIndex];
                var endSpan = spanElements[endSpanIndex];

                var startOffsetTop = startSpan.offsetTop;
                var endOffsetTop = endSpan.offsetTop;
                var totalHeight = endOffsetTop - startOffsetTop + endSpan.offsetHeight;

                console.log('从第一个<span class="lnt">到第10个<span class="lnt">的总高度为:', totalHeight, '像素。');
            } else {
                console.log('索引超出范围');
            }
        } else {
            console.log('未找到匹配的<span class="lnt">元素');
        }

        var preElement = document.querySelector('.single .content .highlight > .chroma table pre');
        var preStyles = window.getComputedStyle(preElement);
        var paddingValue = preStyles.getPropertyValue('padding');
        var paddingNumbers = paddingValue.split(" ");
        var firstPaddingValue = parseInt(paddingNumbers[0]);

        console.log("padding 的值为：" + firstPaddingValue);

        const lines = highlightElement.getElementsByClassName('line');
        const numLines = lines.length;
        numLinesArray.push(numLines);
        console.log('未折叠前行数：', numLines);

        const maxHeight = totalHeight + firstPaddingValue + 5;		//最后的这个5可以根据实际微调
        maxHeights.push(maxHeight);
        console.log('maxHeight的值:', maxHeight);
    }
    );

    CodeBlock.initCodeBlockOverflowY(maxHeights, lntdHeights);
}
;

const CodeBlock = {
    maxLines: 20,

    initCodeBlockOverflowY: function(maxHeights, lntdHeights) {
        const codeBlocks = document.getElementsByClassName('highlight');
        Array.from(codeBlocks).forEach(function(codeBlock, index) {
            const numLines = codeBlock.getElementsByClassName('line').length;
            console.log('未折叠前行数：', numLines);
            const maxHeight = maxHeights[index];
            console.log('maxHeight的值:', maxHeight);

            if (numLines > CodeBlock.maxLines) {
                let codeWrapper = codeBlock.querySelector('.table-wrapper');
                codeWrapper.style.height = maxHeight + 'px';

                let showMoreDiv = document.createElement('div');
                showMoreDiv.id = codeBlock.id + '-more';
                showMoreDiv.style.cssText = 'text-align: center;cursor: pointer;';
                showMoreDiv.innerHTML = '<i class="fa-solid fa-angles-down fa-beat-fade"></i>';
				showMoreDiv.style.backgroundColor = '#e2e9efa6';		//添加背景颜色
				showMoreDiv.querySelector('i').style.color = '#a19e98';		//修改箭头图标颜色
                codeBlock.appendChild(showMoreDiv);

                showMoreDiv.addEventListener('click', function() {
                    if (showMoreDiv.innerHTML.indexOf('fa-angles-down') > -1) {
                        codeWrapper.style.height = 'auto';
                        showMoreDiv.innerHTML = '<i class="fa-solid fa-angles-up fa-beat-fade"></i>';
                        showMoreDiv.style.cssText = 'text-align: center; cursor: pointer;';
						showMoreDiv.style.backgroundColor = '#e2e9efa6';		//添加背景颜色
						showMoreDiv.querySelector('i').style.color = '#a19e98';		//修改箭头图标颜色						
                    } else {
                        codeWrapper.style.height = maxHeight + 'px';
                        showMoreDiv.innerHTML = '<i class="fa-solid fa-angles-down fa-beat-fade"></i>';
                        showMoreDiv.style.cssText = 'text-align: center; cursor: pointer;';
						showMoreDiv.style.backgroundColor = '#e2e9efa6';		//添加背景颜色
						showMoreDiv.querySelector('i').style.color = '#a19e98';		//修改箭头图标颜色							
                    }
                    window.scrollTo({
                        top: codeBlock.offsetTop,
                        behavior: 'smooth'
                    });
                });
            }
        });
    },
    hello: function(msg) {
        console.info('CodeBlock.hello()=%s, by ayu', msg);
    },

    init: function(args) {
        this.hello(args);
    }
};

CodeBlock.init('hello world');
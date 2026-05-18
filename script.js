let currentMode = 'discrete'; // 'discrete' or 'grouped'

document.addEventListener('DOMContentLoaded', () => {
    // Mode Switching
    document.getElementById('discreteMode').addEventListener('click', () => setMode('discrete'));
    document.getElementById('groupedMode').addEventListener('click', () => setMode('grouped'));

    // Row Management
    document.getElementById('addRowBtn').addEventListener('click', () => addRow());
    document.getElementById('clearBtn').addEventListener('click', clearTable);
    document.getElementById('calculateBtn').addEventListener('click', calculate);

    // Initial rows
    for (let i = 0; i < 3; i++) addRow();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});

function setMode(mode) {
    currentMode = mode;
    document.getElementById('discreteMode').classList.toggle('active', mode === 'discrete');
    document.getElementById('groupedMode').classList.toggle('active', mode === 'grouped');

    const headerX = document.querySelector('#table-header th:first-child');
    headerX.textContent = mode === 'discrete' ? 'x (Value)' : 'Class Interval (e.g. 10-20)';

    clearTable();
    for (let i = 0; i < 3; i++) addRow();
    document.getElementById('results-section').classList.add('hidden');
}

function addRow() {
    const tbody = document.getElementById('table-body');
    const tr = document.createElement('tr');

    const inputType = currentMode === 'discrete' ? 'number' : 'text';
    const placeholder = currentMode === 'discrete' ? 'x' : '10-20';

    tr.innerHTML = `
        <td><input type="${inputType}" class="val-x" placeholder="${placeholder}"></td>
        <td><input type="number" class="val-f" placeholder="f" min="0"></td>
        <td><button class="remove-row">&times;</button></td>
    `;

    tr.querySelector('.remove-row').addEventListener('click', () => {
        tr.remove();
        if (tbody.children.length === 0) addRow();
    });

    tbody.appendChild(tr);
}

function clearTable() {
    document.getElementById('table-body').innerHTML = '';
    document.getElementById('results-section').classList.add('hidden');
}

function calculate() {
    const rows = document.querySelectorAll('#table-body tr');
    let data = [];
    let isValid = true;

    rows.forEach(row => {
        const xVal = row.querySelector('.val-x').value.trim();
        const fVal = parseFloat(row.querySelector('.val-f').value);

        if (xVal !== '' && !isNaN(fVal)) {
            if (currentMode === 'discrete') {
                data.push({ x: parseFloat(xVal), f: fVal });
            } else {
                const parts = xVal.split('-').map(p => parseFloat(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    data.push({ xStart: parts[0], xEnd: parts[1], xMid: (parts[0] + parts[1]) / 2, f: fVal });
                } else {
                    isValid = false;
                }
            }
        }
    });

    if (data.length === 0 || !isValid) {
        alert('Please enter valid data. For grouped data, use format "10-20".');
        return;
    }

    displayResults(data);
}

function displayResults(data) {
    const resultsSection = document.getElementById('results-section');
    const summaryDiv = document.getElementById('summary-results');
    const stepsContent = document.getElementById('steps-content');

    resultsSection.classList.remove('hidden');
    summaryDiv.innerHTML = '';
    stepsContent.innerHTML = '';

    if (currentMode === 'discrete') {
        calculateDiscrete(data, summaryDiv, stepsContent);
    } else {
        calculateGrouped(data, summaryDiv, stepsContent);
    }

    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function calculateDiscrete(data, summaryDiv, stepsContent) {
    // Sort data by x
    data.sort((a, b) => a.x - b.x);

    let sumF = 0;
    let sumFX = 0;
    data.forEach(item => {
        sumF += item.f;
        sumFX += item.f * item.x;
    });

    const mean = sumFX / sumF;

    // Median
    let cumulativeF = 0;
    let median;
    const medianPos = (sumF + 1) / 2;
    for (let item of data) {
        cumulativeF += item.f;
        if (cumulativeF >= medianPos) {
            median = item.x;
            break;
        }
    }

    // Mode
    let maxF = Math.max(...data.map(item => item.f));
    let modes = data.filter(item => item.f === maxF).map(item => item.x);

    summaryDiv.innerHTML = `
        <div class="result-card"><strong>Mean (x̄):</strong> ${mean.toFixed(2)}</div>
        <div class="result-card"><strong>Median:</strong> ${median}</div>
        <div class="result-card"><strong>Mode:</strong> ${modes.join(', ')}</div>
    `;

    // Steps
    let steps = `<strong>1. Mean Calculation:</strong><br>`;
    steps += `Formula: x̄ = Σfx / Σf<br><br>`;
    steps += `Table:<br>x\tf\tfx<br>`;
    data.forEach(item => {
        steps += `${item.x}\t${item.f}\t${item.x * item.f}<br>`;
    });
    steps += `<br>Σf = ${sumF}<br>Σfx = ${sumFX}<br>x̄ = ${sumFX} / ${sumF} = ${mean.toFixed(4)}<br><br>`;

    steps += `<strong>2. Median Calculation:</strong><br>`;
    steps += `Position = (N + 1) / 2 = (${sumF} + 1) / 2 = ${medianPos}<br>`;
    steps += `Cumulative Frequencies:<br>`;
    let cf = 0;
    data.forEach(item => {
        cf += item.f;
        steps += `x=${item.x}: cf=${cf}<br>`;
    });
    steps += `Median is the value where cf first reaches ${medianPos}, which is ${median}.<br><br>`;

    steps += `<strong>3. Mode Calculation:</strong><br>`;
    steps += `Mode is the value with the highest frequency (${maxF}).<br>`;
    steps += `Result: ${modes.join(', ')}`;

    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = steps;
    stepsContent.appendChild(stepDiv);
}

function calculateGrouped(data, summaryDiv, stepsContent) {
    let sumF = 0;
    let sumFX = 0;
    data.forEach(item => {
        sumF += item.f;
        sumFX += item.f * item.xMid;
    });

    const mean = sumFX / sumF;

    // Median
    const N = sumF;
    const medianPos = N / 2;
    let cf = 0;
    let medianClass;
    let prevCF = 0;

    for (let i = 0; i < data.length; i++) {
        prevCF = cf;
        cf += data[i].f;
        if (cf >= medianPos) {
            medianClass = data[i];
            break;
        }
    }

    const L = medianClass.xStart;
    const f = medianClass.f;
    const h = medianClass.xEnd - medianClass.xStart;
    const median = L + ((medianPos - prevCF) / f) * h;

    // Mode
    let maxF = 0;
    let modalIndex = 0;
    for(let i=0; i<data.length; i++) {
        if(data[i].f > maxF) {
            maxF = data[i].f;
            modalIndex = i;
        }
    }

    const modalClass = data[modalIndex];
    const f1 = modalClass.f;
    const f0 = modalIndex > 0 ? data[modalIndex - 1].f : 0;
    const f2 = modalIndex < data.length - 1 ? data[modalIndex + 1].f : 0;
    const Lm = modalClass.xStart;
    const hm = modalClass.xEnd - modalClass.xStart;

    const mode = Lm + ((f1 - f0) / ((f1 - f0) + (f1 - f2))) * hm;

    summaryDiv.innerHTML = `
        <div class="result-card"><strong>Mean (x̄):</strong> ${mean.toFixed(2)}</div>
        <div class="result-card"><strong>Median:</strong> ${median.toFixed(2)}</div>
        <div class="result-card"><strong>Mode:</strong> ${mode.toFixed(2)}</div>
    `;

    // Steps
    let steps = `<strong>1. Mean Calculation:</strong><br>`;
    steps += `Formula: x̄ = Σfx / Σf  (where x is midpoint)<br><br>`;
    steps += `Table:<br>Interval\tx(mid)\tf\tfx<br>`;
    data.forEach(item => {
        steps += `${item.xStart}-${item.xEnd}\t${item.xMid}\t${item.f}\t${(item.xMid * item.f).toFixed(2)}<br>`;
    });
    steps += `<br>Σf = ${sumF}<br>Σfx = ${sumFX.toFixed(2)}<br>x̄ = ${sumFX.toFixed(2)} / ${sumF} = ${mean.toFixed(4)}<br><br>`;

    steps += `<strong>2. Median Calculation:</strong><br>`;
    steps += `Formula: Median = L + [ (N/2 - cf_p) / f ] * h<br>`;
    steps += `N/2 = ${N} / 2 = ${medianPos}<br>`;
    steps += `Median Class: ${medianClass.xStart}-${medianClass.xEnd} (where cf reaches ${medianPos})<br>`;
    steps += `L (Lower limit) = ${L}<br>`;
    steps += `cf_p (Preceding cf) = ${prevCF}<br>`;
    steps += `f (Frequency) = ${f}<br>`;
    steps += `h (Class width) = ${h}<br>`;
    steps += `Median = ${L} + [ (${medianPos} - ${prevCF}) / ${f} ] * ${h} = ${median.toFixed(4)}<br><br>`;

    steps += `<strong>3. Mode Calculation:</strong><br>`;
    steps += `Formula: Mode = L + [ (f1 - f0) / (2f1 - f0 - f2) ] * h<br>`;
    steps += `Modal Class: ${modalClass.xStart}-${modalClass.xEnd} (Highest frequency: ${f1})<br>`;
    steps += `L = ${Lm}, f1 = ${f1}, f0 = ${f0}, f2 = ${f2}, h = ${hm}<br>`;
    steps += `Mode = ${Lm} + [ (${f1} - ${f0}) / (${(f1-f0) + (f1-f2)}) ] * ${hm} = ${mode.toFixed(4)}`;

    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = steps;
    stepsContent.appendChild(stepDiv);
}

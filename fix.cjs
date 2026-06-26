const fs = require('fs');
let code = fs.readFileSync('src/components/FinanceScreen.tsx', 'utf8');

// 1. Add date range states
code = code.replace(
  'const [avulsoValue, setAvulsoValue] = useState(\'\');',
  `const [avulsoValue, setAvulsoValue] = useState('');

  // Date range for Reports
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });`
);

// 2. Fix getReportSummary
code = code.replace(
  `const getReportSummary = () => {
    const monthCases = cases.filter(c => c.created_at.startsWith(selectedMonth) && c.status !== 'cancelado' && (showUndeliveredCases || c.status === 'entregue'));`,
  `const getReportSummary = () => {
    const monthCases = cases.filter(c => {
      const caseDate = c.created_at.split('T')[0];
      return caseDate >= reportStartDate && caseDate <= reportEndDate && c.status !== 'cancelado' && (showUndeliveredCases || c.status === 'entregue');
    });`
);

// 3. Fix handleExportCSV
code = code.replace(
  `const handleExportCSV = () => {
    const monthCases = cases.filter(c => c.created_at.startsWith(selectedMonth) && c.status !== 'cancelado' && (showUndeliveredCases || c.status === 'entregue'));`,
  `const handleExportCSV = () => {
    const monthCases = cases.filter(c => {
      const caseDate = c.created_at.split('T')[0];
      return caseDate >= reportStartDate && caseDate <= reportEndDate && c.status !== 'cancelado' && (showUndeliveredCases || c.status === 'entregue');
    });`
);

// Fix toFixed
code = code.replace('const valMatheus = c.value_matheus.toFixed(2).replace(\'.\', \',\');', 'const valMatheus = (c.value_matheus || 0).toFixed(2).replace(\'.\', \',\');');
code = code.replace('const valPlanning = c.value_planning.toFixed(2).replace(\'.\', \',\');', 'const valPlanning = (c.value_planning || 0).toFixed(2).replace(\'.\', \',\');');
code = code.replace('const valPaschoal = c.value_paschoal.toFixed(2).replace(\'.\', \',\');', 'const valPaschoal = (c.value_paschoal || 0).toFixed(2).replace(\'.\', \',\');');
code = code.replace('const valTotal = c.total_value.toFixed(2).replace(\'.\', \',\');', 'const valTotal = (c.total_value || 0).toFixed(2).replace(\'.\', \',\');');

// 4. Update chart logic
const oldChartLogic = `      const matheus = monthCases.reduce((s, c) => s + c.value_matheus, 0);
      const paschoal = monthCases.reduce((s, c) => s + c.value_paschoal, 0);
      const total = monthCases.reduce((s, c) => s + c.total_value, 0);

      data.push({
        name: \`\${monthNames[current.getMonth()]}/\${String(current.getFullYear()).slice(2)}\`,
        matheus,
        paschoal,
        total
      });`;

const newChartLogic = `      const matheus = monthCases.reduce((s, c) => s + (c.value_matheus || 0), 0);
      const planning = monthCases.reduce((s, c) => s + (c.value_planning || 0), 0);
      const paschoal = monthCases.reduce((s, c) => s + (c.value_paschoal || 0), 0);
      const andrey = monthCases.reduce((s, c) => s + (c.cost_andrey || 0), 0);
      const otherCosts = monthCases.reduce((sum, c) => {
        const caseOther = c.other_internal_costs || [];
        return sum + caseOther.reduce((s, o) => s + (o.value || 0), 0);
      }, 0);
      const custos_internos = andrey + otherCosts;
      const total = monthCases.reduce((s, c) => s + (c.total_value || 0), 0);

      data.push({
        name: \`\${monthNames[current.getMonth()]}/\${String(current.getFullYear()).slice(2)}\`,
        matheus,
        planning,
        paschoal,
        custos_internos,
        total
      });`;

code = code.replace(oldChartLogic, newChartLogic);

// 5. Update Reports Header UI
const oldHeaderUI = `<h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Métricas Detalhadas do Mês</h3>`;
const newHeaderUI = `<div className="flex flex-col">
              <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Métricas Detalhadas</h3>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
                <span className="text-xs font-bold text-slate-400">até</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>`;
code = code.replace(oldHeaderUI, newHeaderUI);

// 6. Update chart tooltips and bars
code = code.replace(
  `                        matheus: 'Dr. Matheus',
                        paschoal: 'Dr. Paschoal',`,
  `                        matheus: 'Dr. Matheus',
                        planning: 'Planning',
                        paschoal: 'Dr. Paschoal',
                        custos_internos: 'Custos Internos',`
);

code = code.replace(
  `                        matheus: 'Dr. Matheus',
                        paschoal: 'Dr. Paschoal',`,
  `                        matheus: 'Dr. Matheus',
                        planning: 'Planning',
                        paschoal: 'Dr. Paschoal',
                        custos_internos: 'Custos Internos',`
);

const oldBars = `<Bar dataKey="matheus" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paschoal" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" fill="#CBD5E1" radius={[4, 4, 0, 0]} />`;

const newBars = `<Bar dataKey="matheus" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="planning" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paschoal" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custos_internos" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" fill="#CBD5E1" radius={[4, 4, 0, 0]} />`;
code = code.replace(oldBars, newBars);

fs.writeFileSync('src/components/FinanceScreen.tsx', code);
console.log('FinanceScreen.tsx updated.');

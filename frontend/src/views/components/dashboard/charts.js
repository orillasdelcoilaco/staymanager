// frontend/src/views/components/dashboard/charts.js
let incomeChart = null;
let nightsChart = null;

function destroyCharts() {
    if (incomeChart) incomeChart.destroy();
    if (nightsChart) nightsChart.destroy();
}

export function renderCharts(kpiResults) {
    destroyCharts();

    const canalData = kpiResults.reservasPorCanal || {};
    const labels = Object.keys(canalData);

    if (labels.length === 0) {
        document.getElementById('income-chart').innerHTML = '<p class="text-center text-gray-500">No hay datos de ingresos por canal para mostrar.</p>';
        document.getElementById('nights-chart').innerHTML = '<p class="text-center text-gray-500">No hay datos de noches por canal para mostrar.</p>';
        return;
    }

    const incomeData = labels.map(label => Math.round(canalData[label].ingreso));
    const payoutData = labels.map(label => Math.round(canalData[label].payout));
    const nightsData = labels.map(label => canalData[label].noches);

    // Gráfico de Ingreso vs Payout
    const incomeCtx = document.getElementById('income-chart')?.getContext('2d');
    if (incomeCtx) {
        incomeChart = new Chart(incomeCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingreso Total',
                        data: incomeData,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Payout Neto',
                        data: payoutData,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + (value / 1000) + 'k';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    datalabels: {
                        display: false
                    }
                }
            }
        });
    }

    // Gráfico de Distribución de Noches
    const nightsCtx = document.getElementById('nights-chart')?.getContext('2d');
    if (nightsCtx) {
        nightsChart = new Chart(nightsCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Noches por Canal',
                    data: nightsData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                    ],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    datalabels: {
                        color: '#fff',
                        font: {
                            weight: 'bold'
                        },
                        formatter: (value, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = sum > 0 ? (value * 100 / sum).toFixed(1) + '%' : '0%';
                            return percentage;
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
}
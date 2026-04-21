// frontend/src/views/crm.js
import { fetchAPI } from '../api.js';
import { renderPipeline, setupPipeline } from './components/crm/crm.pipeline.js';
import { renderTable, setupTable } from './components/crm/crm.table.js';
import { renderCampaigns, setupCampaigns } from './components/crm/crm.campaigns.js';
import { renderCoupons, setupCoupons } from './components/crm/crm.coupons.js';

let dashboard = null;
let activeTab = 'pipeline';

function getTabClasses(tabId) {
    if (tabId === activeTab) {
        return 'border-b-2 border-primary-500 text-primary-600 font-semibold';
    }
    return 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
}

export async function render() {
    try {
        dashboard = await fetchAPI('/crm/dashboard');
    } catch (error) {
        return `<div class="bg-white rounded-xl p-8 text-center">
            <p class="text-danger-500">Error al cargar el CRM: ${error.message}</p>
            <button onclick="location.reload()" class="btn-primary mt-4">Reintentar</button>
        </div>`;
    }

    return `
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">CRM</h1>
                    <p class="text-sm text-gray-500 mt-1">Gestión de relaciones con clientes</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="border-b border-gray-200">
                <nav class="flex gap-6 -mb-px">
                    <button id="tab-pipeline" class="crm-tab pb-3 text-sm ${getTabClasses('pipeline')}" data-tab="pipeline">
                        <i class="fa-solid fa-chart-column mr-1.5"></i>Pipeline
                    </button>
                    <button id="tab-clientes" class="crm-tab pb-3 text-sm ${getTabClasses('clientes')}" data-tab="clientes">
                        <i class="fa-solid fa-users mr-1.5"></i>Clientes
                    </button>
                    <button id="tab-campanas" class="crm-tab pb-3 text-sm ${getTabClasses('campanas')}" data-tab="campanas">
                        <i class="fa-solid fa-bullhorn mr-1.5"></i>Campañas
                    </button>
                    <button id="tab-cupones" class="crm-tab pb-3 text-sm ${getTabClasses('cupones')}" data-tab="cupones">
                        <i class="fa-solid fa-ticket mr-1.5"></i>Cupones
                    </button>
                </nav>
            </div>

            <!-- Tab panels -->
            <div id="panel-pipeline" class="crm-panel ${activeTab !== 'pipeline' ? 'hidden' : ''}">
                ${renderPipeline(dashboard)}
            </div>
            <div id="panel-clientes" class="crm-panel ${activeTab !== 'clientes' ? 'hidden' : ''}">
                ${renderTable()}
            </div>
            <div id="panel-campanas" class="crm-panel ${activeTab !== 'campanas' ? 'hidden' : ''}">
                ${renderCampaigns(dashboard.campanasRecientes)}
            </div>
            <div id="panel-cupones" class="crm-panel ${activeTab !== 'cupones' ? 'hidden' : ''}">
                ${renderCoupons()}
            </div>
        </div>`;
}

export async function afterRender() {
    // Tab switching
    document.querySelectorAll('.crm-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabId = tab.dataset.tab;
            activeTab = tabId;

            // Update tab styles
            document.querySelectorAll('.crm-tab').forEach(t => {
                t.classList.remove('border-primary-500', 'text-primary-600', 'font-semibold');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('border-primary-500', 'text-primary-600', 'font-semibold');
            tab.classList.remove('border-transparent', 'text-gray-500');

            // Show/hide panels
            document.querySelectorAll('.crm-panel').forEach(p => p.classList.add('hidden'));
            document.getElementById(`panel-${tabId}`)?.classList.remove('hidden');

            // Lazy-load tab content
            if (tabId === 'clientes' && !document.getElementById('crm-table-tbody')?.children.length) {
                await setupTable();
            }
            if (tabId === 'campanas') {
                await setupCampaigns();
            }
            if (tabId === 'cupones') {
                await setupCoupons();
            }
        });
    });

    // Initialize default tab
    await setupPipeline();
}

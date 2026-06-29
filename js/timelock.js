/**
 * @module timelock
 * @description TimeLock Vault functionality for staking Uniswap V4 NFTs under a time lock.
 *
 * Handles:
 * - Creating TimeLockVaults via the TimeLockFactory
 * - Loading and displaying the user's vaults
 * - Staking/unstaking NFTs through the vault
 * - Collecting rewards through the vault
 * - Transferring vault ownership
 */

import {
    positionManager_address,
    tokenAddresses,
    contractAddress_PositionFinderPro,
    hookAddress,
    MULTICALL_ADDRESS,
    WETHbase
} from './config.js';

import { getSymbolFromAddress, tokenAddressesDecimals } from './utils.js';

import {
    showSuccessNotificationCentered,
    showErrorNotificationCentered,
    showInfoNotificationCentered,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification
} from './ui.js';

import { positionData, stakingPositionData } from './positions.js';

// ============================================
// CONFIGURATION
// ============================================

// Address of the deployed TimeLockFactory contract.
// Update this when the contract is deployed.
export const TIMELOCK_FACTORY_ADDRESS = "0x7d1CFE679f6BA6483191ed13Ddf021F5D8cAD5aD";
//old 0x758927C0d2a325656f4c485f590603495cDe5c33
// ============================================
// ABIs
// ============================================

const TIMELOCK_FACTORY_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "unlockTime", "type": "uint256" }],
        "name": "createVault",
        "outputs": [{ "internalType": "address", "name": "vault", "type": "address" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
        "name": "getVaults",
        "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "myLatestVault",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
            { "indexed": true, "internalType": "address", "name": "vault", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "unlockTime", "type": "uint256" }
        ],
        "name": "VaultCreated",
        "type": "event"
    }
];

const TIMELOCK_VAULT_ABI = [
    // View functions
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "unlockTime",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "isLocked",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "secondsUntilUnlock",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getStakedTokenIds",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
        "name": "tokenBalances",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "stakedNFTs",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    // NFT staking
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "stakeUniswapV4NFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "withdrawNFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // ERC-20 deposit/withdraw
    {
        "inputs": [
            { "internalType": "address", "name": "token", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "depositToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
        "name": "withdrawToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Rewards
    {
        "inputs": [],
        "name": "getRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address[]", "name": "rewardTokensToGet", "type": "address[]" }
        ],
        "name": "getRewardForTokensContract",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "startIndex", "type": "uint256" },
            { "internalType": "uint256", "name": "Count", "type": "uint256" }
        ],
        "name": "exitAllTogether",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Ownership
    {
        "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const NFT_APPROVE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// ============================================
// STATE
// ============================================

let selectedVaultAddress = null;
let userVaults = []; // array of { address, unlockTime, isLocked, stakedTokenIds }
let masqueradeAddress = null; // when set, vaults are loaded for this address instead of window.userAddress

// ============================================
// CUSTOM ERROR DECODING
// ============================================

// 4-byte selectors for the vault's custom errors (keccak256 of the signature)
const VAULT_ERRORS = {
    '0x1f2a2005': 'ZeroAmount — this token has no balance in the vault.',
    '0x4bed5e54': 'TransferFailed — the token transfer was rejected.',
    '0x30cd7471': 'NotOwner — you are not the owner of this vault.',
    '0x0a27042e': 'StillLocked — the vault is still time-locked and cannot be withdrawn yet.',
    '0x69a37f7b': 'NFTAlreadyStaked — that NFT is already staked in this vault.',
    '0xe16a9952': 'NFTNotStaked — that NFT is not staked in this vault.',
    '0x0a4b81f4': 'VaultAlreadyUnlocked — vault is unlocked; ownership transfer is disabled.',
};

function decodeVaultError(err) {
    // Try to extract the 4-byte selector from the error data
    const data = err?.error?.data?.data
        || err?.error?.data?.originalError?.data
        || err?.data?.data
        || err?.data;
    if (typeof data === 'string' && data.length >= 10) {
        const selector = data.slice(0, 10).toLowerCase();
        if (VAULT_ERRORS[selector]) return VAULT_ERRORS[selector];
    }
    return err?.reason || err?.message || 'Transaction failed.';
}

// ============================================
// HELPERS
// ============================================

function disableBtn(id, msg = '<span class="spinner"></span> Processing...') {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    btn.innerHTML = msg;
}

function enableBtn(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
}

function formatUnlockTime(unixTs) {
    const d = new Date(Number(unixTs) * 1000);
    return d.toLocaleString();
}

function formatCountdown(seconds) {
    if (seconds <= 0) return 'Unlocked';
    const days = Math.floor(seconds / 86400);
    const hrs  = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0)  return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
}

function isFactoryDeployed() {
    return TIMELOCK_FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000";
}

// ============================================
// LOAD PAGE
// ============================================

/**
 * Called when the Timelock tab becomes active.
 * Renders the allowed NFT list and loads user vaults if wallet is connected.
 */
export function loadTimelockPage() {
    renderAllowedNFTs();
    _updateMasqueradeBanner();
    if (window.walletConnected || masqueradeAddress) {
        loadUserVaults();
    }
}

// ============================================
// MASQUERADE
// ============================================

/**
 * Sets a masquerade address and reloads vaults for that address.
 * Your connected wallet is still used to sign permissionless withdrawal txs.
 */
export async function setMasquerade() {
    const input = document.getElementById('timelock-masquerade-input');
    const addr = input?.value?.trim();

    if (!addr || !ethers.utils.isAddress(addr)) {
        showErrorNotificationCentered('Invalid Address', 'Enter a valid Ethereum address to masquerade as.');
        return;
    }

    masqueradeAddress = ethers.utils.getAddress(addr); // checksum
    selectedVaultAddress = null;

    const panel = document.getElementById('timelock-vault-actions');
    if (panel) panel.style.display = 'none';

    _updateMasqueradeBanner();

    if (!isFactoryDeployed()) {
        showErrorNotificationCentered('Not Deployed', 'TimeLock Factory address not set.');
        return;
    }

    showInfoNotificationCentered('Masquerading', `Loading vaults for ${masqueradeAddress}...`);
    await loadUserVaults();
}

/**
 * Clears masquerade mode and reloads the connected wallet's own vaults.
 */
export async function clearMasquerade() {
    masqueradeAddress = null;
    selectedVaultAddress = null;

    const input = document.getElementById('timelock-masquerade-input');
    if (input) input.value = '';

    const panel = document.getElementById('timelock-vault-actions');
    if (panel) panel.style.display = 'none';

    _updateMasqueradeBanner();
    await loadUserVaults();
}

function _updateMasqueradeBanner() {
    const banner = document.getElementById('timelock-masquerade-banner');
    const heading = document.getElementById('timelock-vaults-heading');
    if (!banner) return;

    if (masqueradeAddress) {
        const short = `${masqueradeAddress.slice(0, 10)}...${masqueradeAddress.slice(-8)}`;
        banner.style.display = 'block';
        banner.innerHTML = `
            <span style="color:#f0a500;font-weight:700">MASQUERADE ACTIVE</span>
            — viewing vaults for <span style="color:#fff;font-family:monospace">${short}</span>.
            Your wallet signs permissionless withdrawal transactions.
            <button class="btn-secondary" onclick="Timelock.clearMasquerade()" style="margin-left:12px;padding:4px 12px;font-size:0.85em">Exit Masquerade</button>`;
        if (heading) heading.textContent = `Vaults for ${short}`;
    } else {
        banner.style.display = 'none';
        if (heading) heading.textContent = 'Your Timelock Vaults';
    }
}

// ============================================
// ALLOWED NFTs DISPLAY
// ============================================

/**
 * Renders the list of allowed (tracked) NFT positions the user owns that can be deposited.
 */
export function renderAllowedNFTs() {
    const container = document.getElementById('timelock-allowed-nfts');
    if (!container) return;

    if (!window.walletConnected) {
        container.innerHTML = '<p style="color:#aaa">Connect your wallet to see your eligible positions.</p>';
        return;
    }

    const entries = Object.values(positionData || {});
    if (entries.length === 0) {
        container.innerHTML = '<p style="color:#aaa">No eligible Uniswap V4 B0x/0xBTC positions found in your wallet.</p>';
        return;
    }

    let html = '<div class="timelock-nft-grid">';
    for (const pos of entries) {
        const tokenId = pos.id.split('_')[1];
        const amount0 = pos.currentTokenA ? Number(pos.currentTokenA).toFixed(4) : '0';
        const amount1 = pos.currentTokenB ? Number(pos.currentTokenB).toFixed(4) : '0';
        const symA = pos.tokenA || 'TokenA';
        const symB = pos.tokenB || 'TokenB';
        html += `
            <div class="timelock-nft-card">
                <div class="timelock-nft-id">NFT #${tokenId}</div>
                <div class="timelock-nft-pool">${pos.pool || 'B0x/0xBTC'}</div>
                <div class="timelock-nft-amounts">${amount0} ${symA} / ${amount1} ${symB}</div>
            </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// VAULT LOADING
// ============================================

/**
 * Loads all TimeLockVaults for the connected user (or masquerade address) and renders them.
 */
export async function loadUserVaults() {
    const container = document.getElementById('timelock-vaults-container');
    if (!container) return;

    const targetAddress = masqueradeAddress || window.userAddress;

    if (!targetAddress) {
        container.innerHTML = '<p style="color:#aaa">Connect wallet to see your vaults.</p>';
        return;
    }

    if (!isFactoryDeployed()) {
        container.innerHTML = '<p style="color:#f0a500">TimeLock Factory contract not yet deployed. Update TIMELOCK_FACTORY_ADDRESS in timelock.js.</p>';
        return;
    }

    container.innerHTML = '<p style="color:#aaa">Loading vaults...</p>';

    _updateMasqueradeBanner();

    try {
        const provider = window.provider || new ethers.providers.JsonRpcProvider(window.customRPC || "https://mainnet.base.org");
        const factoryContract = new ethers.Contract(TIMELOCK_FACTORY_ADDRESS, TIMELOCK_FACTORY_ABI, provider);

        const vaultAddresses = await factoryContract.getVaults(targetAddress);

        if (!vaultAddresses || vaultAddresses.length === 0) {
            const who = masqueradeAddress
                ? `${masqueradeAddress.slice(0, 8)}...${masqueradeAddress.slice(-6)}`
                : 'You';
            container.innerHTML = `<p style="color:#aaa">${who} have no timelock vaults yet.</p>`;
            userVaults = [];
            return;
        }

        userVaults = [];
        for (const addr of vaultAddresses) {
            try {
                const vaultContract = new ethers.Contract(addr, TIMELOCK_VAULT_ABI, provider);
                const [unlockTime, locked, secsLeft, nftIds] = await Promise.all([
                    vaultContract.unlockTime(),
                    vaultContract.isLocked(),
                    vaultContract.secondsUntilUnlock(),
                    vaultContract.getStakedTokenIds()
                ]);
                userVaults.push({
                    address: addr,
                    unlockTime: unlockTime.toString(),
                    isLocked: locked,
                    secondsLeft: secsLeft.toNumber(),
                    stakedTokenIds: nftIds.map(id => id.toString())
                });
            } catch (e) {
                console.warn(`Failed to load vault ${addr}:`, e);
                userVaults.push({ address: addr, unlockTime: '0', isLocked: false, secondsLeft: 0, stakedTokenIds: [] });
            }
        }

        renderVaultCards(container);
    } catch (err) {
        console.error("Error loading vaults:", err);
        container.innerHTML = `<p style="color:#e55">Error loading vaults: ${err.message}</p>`;
    }
}

function renderVaultCards(container) {
    if (!container) return;
    if (userVaults.length === 0) {
        container.innerHTML = '<p style="color:#aaa">No vaults found.</p>';
        return;
    }

    let html = '';
    for (const vault of userVaults) {
        const lockLabel = vault.isLocked
            ? `<span style="color:#f0a500">LOCKED — unlocks in ${formatCountdown(vault.secondsLeft)}</span>`
            : `<span style="color:#4caf50">UNLOCKED</span>`;
        const shortAddr = vault.address.slice(0, 8) + '...' + vault.address.slice(-6);
        const stakedList = vault.stakedTokenIds.length > 0
            ? vault.stakedTokenIds.map(id => `NFT #${id}`).join(', ')
            : 'None';

        html += `
        <div class="timelock-vault-card ${selectedVaultAddress === vault.address ? 'selected' : ''}">
            <div class="timelock-vault-header">
                <span class="timelock-vault-addr" title="${vault.address}">${shortAddr}</span>
                ${lockLabel}
            </div>
            <div class="timelock-vault-detail">Unlocks: ${formatUnlockTime(vault.unlockTime)}</div>
            <div class="timelock-vault-detail">NFTs in Vault: ${stakedList}</div>
            <button class="btn-primary timelock-select-btn" onclick="Timelock.selectVault('${vault.address}')">
                ${selectedVaultAddress === vault.address ? 'Selected' : 'Select Vault'}
            </button>
        </div>`;
    }

    container.innerHTML = html;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// ============================================
// VAULT SELECTION
// ============================================

export async function refreshSelectedVault() {
    await loadUserVaults();
    if (selectedVaultAddress) {
        await refreshVaultStatus(selectedVaultAddress);
        await populateNFTSelectors(selectedVaultAddress);
        await loadVaultTokenBalances(selectedVaultAddress);
    }
}

/**
 * Selects a vault and populates the actions panel.
 */
export async function selectVault(vaultAddress) {
    selectedVaultAddress = vaultAddress;

    // Re-render vault cards to highlight selected
    const container = document.getElementById('timelock-vaults-container');
    renderVaultCards(container);

    // Show the actions panel
    const panel = document.getElementById('timelock-vault-actions');
    if (panel) panel.style.display = 'block';

    const addrEl = document.getElementById('timelock-selected-vault-addr');
    if (addrEl) addrEl.textContent = vaultAddress;

    await refreshVaultStatus(vaultAddress);
    await populateNFTSelectors(vaultAddress);
    await loadVaultTokenBalances(vaultAddress);
}

async function refreshVaultStatus(vaultAddress) {
    const statusEl = document.getElementById('timelock-vault-status');
    if (!statusEl) return;

    try {
        const provider = window.provider || new ethers.providers.JsonRpcProvider(window.customRPC || "https://mainnet.base.org");
        const vault = new ethers.Contract(vaultAddress, TIMELOCK_VAULT_ABI, provider);
        const [locked, secsLeft, unlockTime, nftIds] = await Promise.all([
            vault.isLocked(),
            vault.secondsUntilUnlock(),
            vault.unlockTime(),
            vault.getStakedTokenIds()
        ]);

        const stakedIds = nftIds.map(id => id.toString());

        const lockText = locked
            ? `<span style="color:#f0a500">Locked — ${formatCountdown(secsLeft.toNumber())} remaining</span>`
            : `<span style="color:#4caf50">Unlocked — withdrawals enabled</span>`;

        statusEl.innerHTML = `
            <div class="timelock-status-row"><b>Status:</b> ${lockText}</div>
            <div class="timelock-status-row"><b>Unlock Time:</b> ${formatUnlockTime(unlockTime.toString())}</div>
            <div class="timelock-status-row"><b>NFTs in Vault:</b> ${stakedIds.length > 0 ? stakedIds.map(id => 'NFT #' + id).join(', ') : 'None'}</div>`;
    } catch (e) {
        statusEl.innerHTML = `<p style="color:#e55">Could not load vault status: ${e.message}</p>`;
    }
}

async function populateNFTSelectors(vaultAddress) {
    // Populate "stake NFT" dropdown with user's unstaked positions
    const stakeSelect = document.getElementById('timelock-nft-select');
    if (stakeSelect) {
        const entries = Object.values(positionData || {});
        if (entries.length === 0) {
            stakeSelect.innerHTML = '<option value="">No eligible positions found</option>';
        } else {
            stakeSelect.innerHTML = entries.map(pos => {
                const tokenId = pos.id.split('_')[1];
                const a = pos.currentTokenA ? Number(pos.currentTokenA).toFixed(4) : '0';
                const b = pos.currentTokenB ? Number(pos.currentTokenB).toFixed(4) : '0';
                const symA = pos.tokenA || '';
                const symB = pos.tokenB || '';
                return `<option value="${tokenId}">NFT #${tokenId} — ${pos.pool || 'B0x/0xBTC'} (${a} ${symA} / ${b} ${symB})</option>`;
            }).join('');
        }
    }

    // Populate ERC-20 token dropdowns
    const tokenOptions = DEPOSIT_TOKENS
        .filter(t => tokenAddresses[t.key] && tokenAddresses[t.key] !== '0x0000000000000000000000000000000000000000')
        .map(t => `<option value="${tokenAddresses[t.key]}">${t.symbol}</option>`)
        .join('');
    const depositTokenSelect = document.getElementById('timelock-token-deposit-select');
    if (depositTokenSelect) depositTokenSelect.innerHTML = tokenOptions;
    const withdrawTokenSelect = document.getElementById('timelock-token-withdraw-select');
    if (withdrawTokenSelect) withdrawTokenSelect.innerHTML = tokenOptions;

    // Populate "withdraw NFT" dropdown from vault's own getStakedTokenIds()
    // — must be vault-specific so we don't show NFTs staked directly (not through this vault)
    const withdrawSelect = document.getElementById('timelock-staked-nft-select');
    if (withdrawSelect) {
        withdrawSelect.innerHTML = '<option value="">Loading vault NFTs...</option>';
        try {
            const rpcUrl = (typeof window.customRPC !== 'undefined' && window.customRPC)
                ? window.customRPC : 'https://mainnet.base.org';
            const readProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const vaultContract = new ethers.Contract(vaultAddress, TIMELOCK_VAULT_ABI, readProvider);
            const stakedIds = await vaultContract.getStakedTokenIds();
            if (stakedIds.length === 0) {
                withdrawSelect.innerHTML = '<option value="">No NFTs staked in this vault</option>';
            } else {
                const POSITION_FINDER_ABI = [
                    {
                        "inputs": [
                            { "internalType": "address", "name": "user", "type": "address" },
                            { "internalType": "address", "name": "Token0", "type": "address" },
                            { "internalType": "address", "name": "Token1", "type": "address" },
                            { "internalType": "uint256", "name": "minAmount0", "type": "uint256" },
                            { "internalType": "uint256", "name": "startIndex", "type": "uint256" },
                            { "internalType": "uint256", "name": "count", "type": "uint256" },
                            { "internalType": "address", "name": "HookAddress", "type": "address" }
                        ],
                        "name": "getIDSofStakedTokensForUserwithMinimum",
                        "outputs": [
                            { "internalType": "uint256[]", "name": "ids", "type": "uint256[]" },
                            { "internalType": "uint256[]", "name": "LiquidityTokenA", "type": "uint256[]" },
                            { "internalType": "uint256[]", "name": "LiquidityTokenB", "type": "uint256[]" },
                            { "internalType": "uint128[]", "name": "positionLiquidity", "type": "uint128[]" },
                            { "internalType": "uint256[]", "name": "timeStakedAt", "type": "uint256[]" },
                            { "internalType": "uint256[]", "name": "multiplierPenalty", "type": "uint256[]" },
                            { "internalType": "address[]", "name": "currency0", "type": "address[]" },
                            { "internalType": "address[]", "name": "currency1", "type": "address[]" },
                            { "internalType": "uint256[]", "name": "poolInfo", "type": "uint256[]" },
                            { "internalType": "int128", "name": "startCountAt", "type": "int128" }
                        ],
                        "stateMutability": "view",
                        "type": "function"
                    },
                    {
                        "inputs": [
                            { "name": "user", "type": "address" },
                            { "name": "tokenIds", "type": "uint256[]" },
                            { "name": "Token0", "type": "address" },
                            { "name": "Token1", "type": "address" },
                            { "name": "HookAddress", "type": "address" },
                            { "name": "minTokenA", "type": "uint256" }
                        ],
                        "name": "findUserTokenIdswithMinimumIndividual",
                        "outputs": [
                            { "name": "ownedTokens", "type": "uint256[]" },
                            { "name": "amountTokenA", "type": "uint256[]" },
                            { "name": "amountTokenB", "type": "uint256[]" },
                            { "name": "positionLiquidity", "type": "uint128[]" },
                            { "name": "feesOwedTokenA", "type": "int128[]" },
                            { "name": "feesOwedTokenB", "type": "int128[]" },
                            {
                                "name": "poolKeyz", "type": "tuple[]",
                                "components": [
                                    { "name": "currency0", "type": "address" },
                                    { "name": "currency1", "type": "address" },
                                    { "name": "fee", "type": "uint24" },
                                    { "name": "tickSpacing", "type": "int24" },
                                    { "name": "hooks", "type": "address" }
                                ]
                            },
                            { "name": "poolInfo", "type": "uint256[]" }
                        ],
                        "stateMutability": "view",
                        "type": "function"
                    }
                ];

                const vaultPosById = {};
                const positionFinder = new ethers.Contract(contractAddress_PositionFinderPro, POSITION_FINDER_ABI, readProvider);

                // Query LP pool staked positions (NFT staked into LP pool through vault)
                try {
                    const result = await positionFinder.getIDSofStakedTokensForUserwithMinimum(
                        vaultAddress,
                        tokenAddresses['B0x'],
                        tokenAddresses['0xBTC'],
                        0, 0, 50,
                        hookAddress
                    );
                    for (let i = 0; i < result[0].length; i++) {
                        const tid = result[0][i].toString();
                        const symA = getSymbolFromAddress(result[6][i]);
                        const symB = getSymbolFromAddress(result[7][i]);
                        const decA = tokenAddressesDecimals[symA] || '18';
                        const decB = tokenAddressesDecimals[symB] || '18';
                        vaultPosById[tid] = {
                            pool: `${symA}/${symB}`,
                            tokenA: symA,
                            tokenB: symB,
                            currentTokenA: ethers.utils.formatUnits(result[1][i], decA),
                            currentTokenB: ethers.utils.formatUnits(result[2][i], decB)
                        };
                    }
                } catch (e) {
                    console.warn('[Timelock] PositionFinder staked query failed:', e);
                }
                await sleep(1000);  
                // For any IDs not found above, query vault-held positions (NFT sitting in vault, not staked in LP pool)
                const missingIds = stakedIds.map(id => id.toString().trim()).filter(tid => !vaultPosById[tid]);
                if (missingIds.length > 0) {
                    try {
                        const result2 = await positionFinder.findUserTokenIdswithMinimumIndividual(
                            vaultAddress,
                            missingIds,
                            tokenAddresses['B0x'],
                            tokenAddresses['0xBTC'],
                            hookAddress,
                            0
                        );
                        for (let i = 0; i < result2[0].length; i++) {
                            const tid = result2[0][i].toString();
                            const poolKey = result2[6][i];
                            const symA = getSymbolFromAddress(poolKey.currency0);
                            const symB = getSymbolFromAddress(poolKey.currency1);
                            const decA = tokenAddressesDecimals[symA] || '18';
                            const decB = tokenAddressesDecimals[symB] || '18';
                            vaultPosById[tid] = {
                                pool: `${symA}/${symB}`,
                                tokenA: symA,
                                tokenB: symB,
                                currentTokenA: ethers.utils.formatUnits(result2[1][i], decA),
                                currentTokenB: ethers.utils.formatUnits(result2[2][i], decB)
                            };
                        }
                    } catch (e) {
                        console.warn('[Timelock] PositionFinder vault-held query failed:', e);
                    }
                }

                withdrawSelect.innerHTML = stakedIds.map(id => {
                    const tokenId = id.toString().trim();
                    const pos = vaultPosById[tokenId];
                    const a = pos?.currentTokenA ? Number(pos.currentTokenA).toFixed(4) : '0';
                    const b = pos?.currentTokenB ? Number(pos.currentTokenB).toFixed(4) : '0';
                    const symA = pos?.tokenA || '';
                    const symB = pos?.tokenB || '';
                    const label = `NFT #${tokenId} — ${pos?.pool || 'B0x/0xBTC'} (${a} ${symA} / ${b} ${symB})`;
                    return `<option value="${tokenId}">${label}</option>`;
                }).join('');
            }
        } catch (e) {
            console.warn('[Timelock] getStakedTokenIds failed:', e);
            withdrawSelect.innerHTML = '<option value="">Could not load vault NFTs</option>';
        }
    }
}

// ============================================
// CREATE VAULT
// ============================================

/**
 * Creates a new TimeLockVault via the factory contract.
 */
export async function createVault() {
    if (!window.walletConnected) {
        await window.connectWallet();
    }

    if (!isFactoryDeployed()) {
        showErrorNotificationCentered('Not Deployed', 'TimeLock Factory address not set. Update TIMELOCK_FACTORY_ADDRESS in timelock.js.');
        return;
    }

    const dtInput = document.getElementById('timelock-unlock-datetime');
    if (!dtInput || !dtInput.value) {
        showErrorNotificationCentered('Missing Date', 'Please select an unlock date and time.');
        return;
    }

    const unlockTimestamp = Math.floor(new Date(dtInput.value).getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);

    if (unlockTimestamp <= nowTs) {
        showErrorNotificationCentered('Invalid Date', 'Unlock time must be in the future.');
        return;
    }

    disableBtn('timelockCreateVaultBtn');

    try {
        const factory = new ethers.Contract(TIMELOCK_FACTORY_ADDRESS, TIMELOCK_FACTORY_ABI, window.signer);
        showInfoNotificationCentered('Creating Vault', 'Confirm the transaction in your wallet...');

        const tx = await factory.createVault(unlockTimestamp);
        showInfoNotificationCentered('Waiting...', 'Transaction submitted, waiting for confirmation...');
        const receipt = await tx.wait();

        showSuccessNotificationCentered('Vault Created!', 'Your TimeLock vault has been deployed.');
        await loadUserVaults();
    } catch (err) {
        console.error('createVault error:', err);
        showErrorNotificationCentered('Failed', err.reason || err.message || 'Could not create vault.');
    } finally {
        enableBtn('timelockCreateVaultBtn');
    }
}

// ============================================
// STAKE NFT TO VAULT
// ============================================

/**
 * Approves the vault to transfer the NFT, then calls vault.stakeUniswapV4NFT().
 */
export async function stakeNFTToVault() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const customStakeId = document.getElementById('timelock-nft-custom-id')?.value?.trim();
    const tokenId = customStakeId || document.getElementById('timelock-nft-select')?.value;
    if (!tokenId) {
        showErrorNotificationCentered('No NFT Selected', 'Please select an NFT position to stake or enter a custom Token #.');
        return;
    }

    disableBtn('timelockStakeNFTBtn');

    try {
        const nftManager = new ethers.Contract(positionManager_address, NFT_APPROVE_ABI, window.signer);
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);

        showInfoNotificationCentered('Step 1/2 — Approve NFT', `Approve NFT #${tokenId} for the vault. Confirm in your wallet.`);
        const approveTx = await nftManager.approve(selectedVaultAddress, tokenId);
        await approveTx.wait();
        showSuccessNotificationCentered('Approved!', 'Now confirm the stake transaction.');

        showInfoNotificationCentered('Step 2/2 — Stake NFT', 'Staking NFT through the vault. Confirm in your wallet.');
        const stakeTx = await vaultContract.stakeUniswapV4NFT(tokenId);
        await stakeTx.wait();

        showSuccessNotificationCentered('NFT Staked!', `NFT #${tokenId} is now staked in your vault.`);
        if (window.getTokenIDsOwnedByMetamask) await window.getTokenIDsOwnedByMetamask(true);
        await loadUserVaults();
        await selectVault(selectedVaultAddress);
        renderAllowedNFTs();
    } catch (err) {
        console.error('stakeNFTToVault error:', err);
        showErrorNotificationCentered('Stake Failed', decodeVaultError(err));
    } finally {
        enableBtn('timelockStakeNFTBtn');
    }
}

// ============================================
// WITHDRAW NFT FROM VAULT
// ============================================

/**
 * Withdraws a staked NFT from the vault back to the owner (only after unlock).
 */
export async function withdrawNFTFromVault() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const customWithdrawId = document.getElementById('timelock-withdraw-custom-id')?.value?.trim();
    const tokenId = customWithdrawId || document.getElementById('timelock-staked-nft-select')?.value;
    if (!tokenId) {
        showErrorNotificationCentered('No NFT Selected', 'Please select a staked NFT to withdraw or enter a custom Token #.');
        return;
    }

    disableBtn('timelockWithdrawNFTBtn');

    try {
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotificationCentered('Withdrawing NFT', `Withdrawing NFT #${tokenId}. Confirm in your wallet.`);
        const tx = await vaultContract.withdrawNFT(tokenId);
        await tx.wait();
        showSuccessNotificationCentered('NFT Withdrawn!', `NFT #${tokenId} has been returned to your wallet.`);
        await loadUserVaults();
        await selectVault(selectedVaultAddress);
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('withdrawNFTFromVault error:', err);
        showErrorNotificationCentered('Withdrawal Failed', decodeVaultError(err));
    } finally {
        enableBtn('timelockWithdrawNFTBtn');
    }
}

// ============================================
// REWARDS
// ============================================

/**
 * Calls getRewards() on the vault to collect all staking rewards.
 */
export async function getVaultRewards() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    disableBtn('timelockGetRewardsBtn');

    try {
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotificationCentered('Collecting Rewards', 'Confirm in your wallet.');
        const tx = await vaultContract.getRewards();
        await tx.wait();
        showSuccessNotificationCentered('Rewards Collected!', 'Staking rewards sent to your vault.');
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('getVaultRewards error:', err);
        showErrorNotificationCentered('Failed', err.reason || err.message || 'Could not collect rewards.');
    } finally {
        enableBtn('timelockGetRewardsBtn');
    }
}

/**
 * Calls getRewardForTokensContract() with the default reward tokens (B0x, 0xBTC).
 */
export async function getVaultRewardsForTokens() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    disableBtn('timelockGetRewardsTokensBtn');

    const rewardTokens = [
        tokenAddresses['B0x'],
        tokenAddresses['0xBTC'],
        tokenAddresses['WETH']
    ];

    try {
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotificationCentered('Collecting Token Rewards', 'Confirm in your wallet.');
        const tx = await vaultContract.getRewardForTokensContract(rewardTokens);
        await tx.wait();
        showSuccessNotificationCentered('Token Rewards Collected!', 'Rewards claimed for B0x, 0xBTC, WETH.');
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('getVaultRewardsForTokens error:', err);
        showErrorNotificationCentered('Failed', err.reason || err.message || 'Could not collect token rewards.');
    } finally {
        enableBtn('timelockGetRewardsTokensBtn');
    }
}

// ============================================
// EXIT ALL
// ============================================

/**
 * Calls exitAllTogether(startIndex, count) on the vault.
 * Collects all rewards and exits LP positions.
 */
export async function exitAllFromVault() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const startInput = document.getElementById('timelock-exit-start');
    const countInput = document.getElementById('timelock-exit-count');
    const startIndex = parseInt(startInput?.value || '0', 10);
    const count = parseInt(countInput?.value || '25', 10);

    disableBtn('timelockExitAllBtn');

    try {
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotification('Exiting All', `Calling exitAllTogether(${startIndex}, ${count}). Confirm in wallet.`);
        const tx = await vaultContract.exitAllTogether(startIndex, count);
        await tx.wait();
        showSuccessNotification('Exit Complete!', 'All rewards collected and LP positions exited.');
        await loadUserVaults();
        await selectVault(selectedVaultAddress);
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('exitAllFromVault error:', err);
        showErrorNotification('Failed', err.reason || err.message || 'Exit failed.');
    } finally {
        enableBtn('timelockExitAllBtn');
    }
}

// ============================================
// TRANSFER OWNERSHIP
// ============================================

/**
 * Transfers vault ownership to a new address (only while vault is locked).
 */
export async function transferVaultOwnership() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotification('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const input = document.getElementById('timelock-new-owner-input');
    const newOwner = input?.value?.trim();

    if (!newOwner || !ethers.utils.isAddress(newOwner)) {
        showErrorNotification('Invalid Address', 'Please enter a valid Ethereum address.');
        return;
    }

    const confirmed = window.confirm(
        `⚠️ WARNING — Permanent Transfer\n\n` +
        `This vault and ALL of its contents (NFTs, tokens, staking positions) will be permanently transferred to:\n\n` +
        `${newOwner}\n\n` +
        `You will have NO way to recover them unless you also control that address. Once confirmed on-chain this action cannot be undone.\n\n` +
        `Are you absolutely sure you want to proceed?`
    );
    if (!confirmed) return;

    disableBtn('timelockTransferOwnerBtn');

    try {
        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotification('Transferring Ownership', `Transferring to ${newOwner}. Confirm in wallet.`);
        const tx = await vaultContract.transferOwnership(newOwner);
        await tx.wait();
        showSuccessNotification('Ownership Transferred!', `Vault is now owned by ${newOwner}.`);
        if (input) input.value = '';
        await loadUserVaults();
    } catch (err) {
        console.error('transferVaultOwnership error:', err);
        showErrorNotification('Failed', err.reason || err.message || 'Transfer failed. Vault may be unlocked.');
    } finally {
        enableBtn('timelockTransferOwnerBtn');
    }
}

// ============================================
// ERC-20 DEPOSIT
// ============================================

const ERC20_MINIMAL_ABI = [
    { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

// Tokens available for ERC-20 deposit/withdraw
const DEPOSIT_TOKENS = [
    { symbol: 'B0x',          key: 'B0x' },
    { symbol: '0xBTC',        key: '0xBTC' },
    { symbol: 'WETH',         key: 'WETH' },
    { symbol: 'USDC',         key: 'USDC' },
    { symbol: 'RightsTo0xBTC', key: 'RightsTo0xBTC' },
];

/**
 * Approve (if needed) then deposit an ERC-20 token into the selected vault.
 */
export async function depositTokenToVault() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const tokenSelect = document.getElementById('timelock-token-deposit-select');
    const amountInput = document.getElementById('timelock-token-deposit-amount');
    const tokenAddr = tokenSelect?.value;
    const amountStr = amountInput?.value?.trim();

    if (!tokenAddr || tokenAddr === '') {
        showErrorNotificationCentered('No Token', 'Please select a token to deposit.');
        return;
    }
    if (!amountStr || isNaN(amountStr) || Number(amountStr) <= 0) {
        showErrorNotificationCentered('Invalid Amount', 'Please enter a valid amount.');
        return;
    }

    disableBtn('timelockDepositTokenBtn');

    try {
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_MINIMAL_ABI, window.signer);
        const decimals = await tokenContract.decimals();
        const amount = ethers.utils.parseUnits(amountStr, decimals);

        // Check allowance
        const allowance = await tokenContract.allowance(window.userAddress, selectedVaultAddress);
        if (allowance.lt(amount)) {
            showInfoNotificationCentered('Step 1/2 — Approve Token', 'Approve the vault to spend your tokens. Confirm in wallet.');
            const approveTx = await tokenContract.approve(selectedVaultAddress, ethers.constants.MaxUint256);
            await approveTx.wait();
            showSuccessNotificationCentered('Approved!', 'Now confirm the deposit transaction.');
        }

        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotificationCentered('Depositing Token', 'Confirm the deposit in your wallet.');
        const depositTx = await vaultContract.depositToken(tokenAddr, amount);
        await depositTx.wait();

        showSuccessNotificationCentered('Token Deposited!', `${amountStr} tokens locked in vault until unlock time.`);
        if (amountInput) amountInput.value = '';
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('depositTokenToVault error:', err);
        showErrorNotificationCentered('Deposit Failed', decodeVaultError(err));
    } finally {
        enableBtn('timelockDepositTokenBtn');
    }
}

// ============================================
// ERC-20 WITHDRAW
// ============================================

/**
 * Withdraw all of a given ERC-20 token from the vault to the owner (after unlock).
 */
export async function withdrawTokenFromVault() {
    if (!window.walletConnected) await window.connectWallet();
    if (!selectedVaultAddress) {
        showErrorNotificationCentered('No Vault Selected', 'Please select a vault first.');
        return;
    }

    const customInput = document.getElementById('timelock-token-withdraw-custom');
    const customAddr = customInput?.value?.trim();
    const tokenSelect = document.getElementById('timelock-token-withdraw-select');
    const tokenAddr = (customAddr && ethers.utils.isAddress(customAddr))
        ? ethers.utils.getAddress(customAddr)
        : tokenSelect?.value;
    if (!tokenAddr || tokenAddr === '') {
        showErrorNotificationCentered('No Token', 'Please select a token or enter a custom ERC-20 address.');
        return;
    }
    if (customAddr && !ethers.utils.isAddress(customAddr)) {
        showErrorNotificationCentered('Invalid Address', 'The custom ERC-20 address is not valid.');
        return;
    }

    disableBtn('timelockWithdrawTokenBtn');

    try {
        const rpcUrl = (typeof window.customRPC !== 'undefined' && window.customRPC)
            ? window.customRPC : 'https://mainnet.base.org';
        const readProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_MINIMAL_ABI, readProvider);
        const vaultRead = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, readProvider);

        // Pre-checks before sending the transaction
        const [vaultBal, isLocked] = await Promise.all([
            tokenContract.balanceOf(selectedVaultAddress),
            vaultRead.isLocked()
        ]);
        if(tokenAddr != tokenAddresses['WETH']){
        if (vaultBal.isZero()) {
            showErrorNotification('No Balance', 'No balance of that token in this vault.');
            enableBtn('timelockWithdrawTokenBtn');
            return;
        }
    }
        if (isLocked) {
            const secsLeft = await vaultRead.secondsUntilUnlock();
            showErrorNotification('Still Locked', `Vault unlocks in ${formatCountdown(secsLeft.toNumber())}. Withdrawals are only allowed after unlock.`);
            enableBtn('timelockWithdrawTokenBtn');
            return;
        }

        const vaultContract = new ethers.Contract(selectedVaultAddress, TIMELOCK_VAULT_ABI, window.signer);
        showInfoNotification('Withdrawing Token', 'Withdrawing all of this token to your wallet. Confirm in wallet.');
        const tx = await vaultContract.withdrawToken(tokenAddr);
        await tx.wait();
        showSuccessNotification('Token Withdrawn!', 'Token balance returned to your wallet.');
        await loadVaultTokenBalances(selectedVaultAddress);
    } catch (err) {
        console.error('withdrawTokenFromVault error:', err);
        showErrorNotification('Withdrawal Failed', decodeVaultError(err));
    } finally {
        enableBtn('timelockWithdrawTokenBtn');
    }
}

// ============================================
// VAULT TOKEN BALANCES
// ============================================

/**
 * Loads ERC-20 balances held inside the vault and renders them.
 * Shows the actual balanceOf (total held) and the tokenBalances (deposited via depositToken).
 * Rewards sent directly to the vault appear in balanceOf but not tokenBalances.
 */
export async function loadVaultTokenBalances(vaultAddress) {
    const container = document.getElementById('timelock-token-balances');
    if (!container) return;

    const rpcUrl = (typeof window.customRPC !== 'undefined' && window.customRPC)
        ? window.customRPC
        : 'https://mainnet.base.org';
    const readProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const fmt = (n) => {
        if (n === 0) return '0';
        if (n < 0.000001) return n.toExponential(4);
        if (n < 0.001)    return n.toPrecision(4);
        return n.toPrecision(6).replace(/\.?0+$/, '');
    };

    // Known decimals — avoids extra calls
    const DECIMALS = { B0x: 18, '0xBTC': 8, WETH: 18, USDC: 6, RightsTo0xBTC: 18 };

    const validTokens = DEPOSIT_TOKENS.filter(
        t => tokenAddresses[t.key] && tokenAddresses[t.key] !== '0x0000000000000000000000000000000000000000'
    );

    const erc20Iface = new ethers.utils.Interface(ERC20_MINIMAL_ABI);
    const multicall  = new ethers.Contract(MULTICALL_ADDRESS, [
        {
            "inputs": [{"components": [{"name": "target","type": "address"},{"name": "allowFailure","type": "bool"},{"name": "callData","type": "bytes"}],"name": "calls","type": "tuple[]"}],
            "name": "aggregate3",
            "outputs": [{"components": [{"name": "success","type": "bool"},{"name": "returnData","type": "bytes"}],"type": "tuple[]"}],
            "stateMutability": "view",
            "type": "function"
        }
    ], readProvider);

    const calls = validTokens.map(tok => ({
        target: tokenAddresses[tok.key],
        allowFailure: true,
        callData: erc20Iface.encodeFunctionData('balanceOf', [vaultAddress])
    }));

    let results = [];
    try {
        results = await multicall.aggregate3(calls);
    } catch (e) {
        console.warn('[Timelock] multicall balanceOf failed:', e);
    }

    let rows = '';
    for (let i = 0; i < validTokens.length; i++) {
        const tok = validTokens[i];
        const decimals = DECIMALS[tok.key] ?? 18;
        try {
            const res = results[i];
            if (!res || !res.success || res.returnData === '0x') {
                throw new Error('bad result');
            }
            const [rawBal] = erc20Iface.decodeFunctionResult('balanceOf', res.returnData);
            const display = parseFloat(ethers.utils.formatUnits(rawBal, decimals));
            rows += `<div class="timelock-token-bal-row ${rawBal.gt(0) ? 'has-balance' : ''}">
                <span class="timelock-token-sym">${tok.symbol}</span>
                <span class="timelock-token-amt">${fmt(display)}</span>
            </div>`;
        } catch {
            rows += `<div class="timelock-token-bal-row">
                <span class="timelock-token-sym">${tok.symbol}</span>
                <span class="timelock-token-amt" style="color:#888">—</span>
            </div>`;
        }
    }
    container.innerHTML = rows || '<p style="color:#aaa">No balances found.</p>';
}

// ============================================
// DATETIME HELPER
// ============================================

/**
 * Updates the displayed unix timestamp from the datetime-local input.
 */
export function updateUnlockTimestamp() {
    const dtInput = document.getElementById('timelock-unlock-datetime');
    const tsEl = document.getElementById('timelock-unlock-ts');
    const distEl = document.getElementById('timelock-unlock-distance');
    if (!dtInput || !tsEl) return;
    if (!dtInput.value) {
        tsEl.value = '';
        if (distEl) distEl.textContent = '';
        return;
    }
    const ts = Math.floor(new Date(dtInput.value).getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);
    tsEl.value = `${ts}`;

    if (distEl) {
        const diff = ts - nowTs;
        if (diff <= 0) {
            distEl.textContent = 'That time is in the past — pick a future date.';
            distEl.style.color = '#e55';
        } else {
            const days  = Math.floor(diff / 86400);
            const hrs   = Math.floor((diff % 86400) / 3600);
            const mins  = Math.floor((diff % 3600) / 60);
            let parts = [];
            if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
            if (hrs  > 0) parts.push(`${hrs} hour${hrs !== 1 ? 's' : ''}`);
            if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
            distEl.textContent = `Locks for ${parts.join(', ')} from now`;
            distEl.style.color = '#4caf50';
        }
    }
}

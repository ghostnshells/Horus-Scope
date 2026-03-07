// Asset definitions for Horus Scope Vulnerability Monitor
// Each asset represents a vendor or product to monitor for vulnerabilities
// Consolidated structure: One card per major vendor (Cisco, Microsoft, HPE) with sub-products

// Vendor Groups for hierarchical navigation
export const VENDOR_GROUPS = {
    WATCHGUARD: 'WatchGuard',
    HPE: 'HPE',
    CISCO: 'Cisco',
    MICROSOFT: 'Microsoft',
    TRIPP_LITE: 'Tripp Lite',
    SOLARWINDS: 'SolarWinds',
    CONNECTWISE: 'ConnectWise',
    ORACLE: 'Oracle',
    VEEAM: 'Veeam',
    ZERTO: 'Zerto',
    BITDEFENDER: 'BitDefender',
    ZOOM: 'Zoom',
    GOOGLE: 'Google',
    MOZILLA: 'Mozilla',
    CRESTRON: 'Crestron',
    CANONICAL: 'Canonical',
    REDHAT: 'Red Hat',
    DEBIAN: 'Debian',
    AMAZON: 'Amazon',
    FORTINET: 'Fortinet',
    PALO_ALTO: 'Palo Alto Networks',
    JUNIPER: 'Juniper',
    DOCKER: 'Docker',
    KUBERNETES: 'Kubernetes'
};

// Asset categories for filtering
export const ASSET_CATEGORIES = {
    FIREWALL_VPN: 'Firewall & VPN',
    STORAGE: 'Storage',
    SERVERS: 'Servers',
    POWER: 'Power & UPS',
    NETWORK: 'Network Infrastructure',
    IT_MANAGEMENT: 'IT Management',
    DATABASE: 'Database',
    BACKUP_DR: 'Backup & DR',
    SECURITY: 'Security',
    COLLABORATION: 'Collaboration',
    BROWSERS: 'Browsers',
    AV_CONTROL: 'AV & Control',
    OPERATING_SYSTEMS: 'Operating Systems',
    ENTERPRISE_SOFTWARE: 'Enterprise Software',
    LINUX_DISTROS: 'Linux Distros',
    CLOUD_PLATFORMS: 'Cloud Platforms',
    NETWORK_SECURITY: 'Network Security',
    CONTAINERS: 'Containers'
};

export const ASSETS = [
    // ==========================================
    // CISCO - Consolidated vendor card
    // Monitors: IOS, IOS XE, IOS XR, ISE, Unified CM (software only - hardware rarely has CVEs)
    // ==========================================
    {
        id: 'cisco',
        name: 'Cisco',
        vendor: 'Cisco',
        category: ASSET_CATEGORIES.NETWORK,
        vendorGroup: VENDOR_GROUPS.CISCO,
        description: 'Cisco networking software including IOS, IOS XE, IOS XR, ISE, and Unified CM',
        // Primary CPE vendor for searching
        cpeVendor: 'cisco',
        // Multiple CPE products to search for (software only)
        cpeProducts: [
            'ios',
            'ios_xe',
            'ios_xr',
            'identity_services_engine',
            'unified_communications_manager'
        ],
        // Keywords for keyword-based searching
        // First keyword is used for the primary search - using 'cisco' to catch all Cisco vulns
        // including those without CPE data yet (like newly published ISE/UCM vulns)
        // Validators filter out false positives (like Apple iOS)
        keywords: [
            'cisco',
            'cisco ios',
            'cisco ios xe',
            'cisco ios xr',
            'cisco ise',
            'cisco identity services engine',
            'cisco unified communications manager',
            'cisco unified cm',
            'cisco cucm'
        ],
        // Sub-products for display and filtering within the vendor card
        subProducts: [
            { id: 'ios', name: 'Cisco IOS', type: 'Software', cpeMatch: [':cisco:ios:'], descMatch: ['cisco ios software'] },
            { id: 'ios-xe', name: 'Cisco IOS XE', type: 'Software', cpeMatch: [':ios_xe'], descMatch: ['ios xe'] },
            { id: 'ios-xr', name: 'Cisco IOS XR', type: 'Software', cpeMatch: [':ios_xr'], descMatch: ['ios xr'] },
            { id: 'ise', name: 'Cisco ISE', type: 'Software', cpeMatch: [':identity_services_engine'], descMatch: ['identity services engine', 'cisco ise'] },
            { id: 'ucm', name: 'Cisco Unified CM', type: 'Software', cpeMatch: [':unified_communications_manager'], descMatch: ['unified communications manager', 'unified cm'] }
        ]
    },

    // ==========================================
    // MICROSOFT - Consolidated vendor card
    // Monitors: Windows OS, Server, Office 365, Exchange, SharePoint, SQL Server, etc.
    // ==========================================
    {
        id: 'microsoft',
        name: 'Microsoft',
        vendor: 'Microsoft',
        category: ASSET_CATEGORIES.ENTERPRISE_SOFTWARE,
        vendorGroup: VENDOR_GROUPS.MICROSOFT,
        description: 'Microsoft products including Windows, Office 365, Exchange, and development tools',
        // Primary CPE vendor for searching
        cpeVendor: 'microsoft',
        // Multiple CPE products to search for
        cpeProducts: [
            'windows_10',
            'windows_11',
            'windows_server_2012',
            'windows_server_2016',
            'windows_server_2019',
            'windows_server_2022',
            'exchange_server',
            'sharepoint_server',
            'sql_server',
            '365_apps',
            'office',
            'visual_studio',
            'teams',
            'edge_chromium',
            'azure'
        ],
        // Keywords for keyword-based searching
        keywords: [
            'microsoft windows',
            'windows server',
            'microsoft exchange',
            'microsoft sharepoint',
            'microsoft sql server',
            'microsoft 365',
            'office 365',
            'microsoft teams',
            'microsoft edge',
            'visual studio',
            'microsoft azure'
        ],
        // Sub-products grouped by category for display
        subProducts: [
            // Desktop OS
            { id: 'windows-10', name: 'Windows 10', type: 'Desktop OS', group: 'Operating Systems', cpeMatch: [':windows_10'], descMatch: ['windows 10'] },
            { id: 'windows-11', name: 'Windows 11', type: 'Desktop OS', group: 'Operating Systems', cpeMatch: [':windows_11'], descMatch: ['windows 11'] },
            // Server OS
            { id: 'server-2012', name: 'Windows Server 2012', type: 'Server OS', group: 'Operating Systems', cpeMatch: [':windows_server_2012'], descMatch: ['windows server 2012'] },
            { id: 'server-2016', name: 'Windows Server 2016', type: 'Server OS', group: 'Operating Systems', cpeMatch: [':windows_server_2016'], descMatch: ['windows server 2016'] },
            { id: 'server-2019', name: 'Windows Server 2019', type: 'Server OS', group: 'Operating Systems', cpeMatch: [':windows_server_2019'], descMatch: ['windows server 2019'] },
            { id: 'server-2022', name: 'Windows Server 2022', type: 'Server OS', group: 'Operating Systems', cpeMatch: [':windows_server_2022'], descMatch: ['windows server 2022'] },
            { id: 'server-2025', name: 'Windows Server 2025', type: 'Server OS', group: 'Operating Systems', cpeMatch: [':windows_server_2025'], descMatch: ['windows server 2025'] },
            // Microsoft 365 / Productivity
            { id: 'office-365', name: 'Microsoft 365 / Office', type: 'Productivity', group: 'Microsoft 365', cpeMatch: [':365_apps', ':office'], descMatch: ['microsoft 365', 'office 365', 'microsoft office'] },
            { id: 'exchange', name: 'Exchange Server', type: 'Email', group: 'Microsoft 365', cpeMatch: [':exchange_server'], descMatch: ['exchange server'] },
            { id: 'sharepoint', name: 'SharePoint', type: 'Collaboration', group: 'Microsoft 365', cpeMatch: [':sharepoint'], descMatch: ['sharepoint'] },
            { id: 'teams', name: 'Microsoft Teams', type: 'Communication', group: 'Microsoft 365', cpeMatch: [':teams'], descMatch: ['microsoft teams'] },
            // Database
            { id: 'sql-server', name: 'SQL Server', type: 'Database', group: 'Data Platform', cpeMatch: [':sql_server'], descMatch: ['sql server'] },
            // Development Tools
            { id: 'visual-studio', name: 'Visual Studio', type: 'IDE', group: 'Development', cpeMatch: [':visual_studio'], descMatch: ['visual studio'] },
            // Browsers
            { id: 'edge', name: 'Microsoft Edge', type: 'Browser', group: 'Applications', cpeMatch: [':edge_chromium', ':edge'], descMatch: ['microsoft edge', 'edge chromium'] },
            // Cloud
            { id: 'azure', name: 'Azure', type: 'Cloud', group: 'Cloud Services', cpeMatch: [':microsoft:azure'], descMatch: ['microsoft azure'] },
            // Frameworks
            { id: 'dotnet', name: '.NET', type: 'Framework', group: 'Development', cpeMatch: [':.net', ':asp.net'], descMatch: ['.net framework', '.net core', 'asp.net'] },
            // Security
            { id: 'defender', name: 'Microsoft Defender', type: 'Security', group: 'Security', cpeMatch: [':defender'], descMatch: ['microsoft defender', 'windows defender'] },
            // Management
            { id: 'config-manager', name: 'Configuration Manager', type: 'Management', group: 'Management', cpeMatch: [':configuration_manager', ':endpoint_configuration_manager'], descMatch: ['configuration manager', 'sccm', 'mecm'] },
            // ERP
            { id: 'dynamics-365', name: 'Dynamics 365', type: 'ERP', group: 'Business Apps', cpeMatch: [':dynamics_365'], descMatch: ['dynamics 365'] },
            // Analytics
            { id: 'power-bi', name: 'Power BI', type: 'Analytics', group: 'Business Apps', cpeMatch: [':power_bi'], descMatch: ['power bi'] }
        ]
    },

    // ==========================================
    // HPE - Consolidated vendor card
    // Monitors: ProLiant servers, Alletra/Nimble Storage, iLO
    // ==========================================
    {
        id: 'hpe',
        name: 'HPE',
        vendor: 'Hewlett Packard Enterprise',
        category: ASSET_CATEGORIES.SERVERS,
        vendorGroup: VENDOR_GROUPS.HPE,
        description: 'HPE infrastructure including ProLiant servers and Nimble/Alletra storage',
        // Primary CPE vendor for searching
        cpeVendor: 'hpe',
        // Additional CPE vendors (HPE uses multiple vendor strings in NVD)
        additionalCpeVendors: ['hp', 'hewlett_packard_enterprise'],
        // Multiple CPE products to search for
        cpeProducts: [
            'proliant',
            'proliant_dl380',
            'proliant_dl360',
            'proliant_ml350',
            'nimble_storage',
            'alletra',
            'integrated_lights-out',
            'ilo',
            'oneview',
            'storeonce'
        ],
        // Keywords for keyword-based searching
        keywords: [
            'hpe proliant',
            'hpe nimble',
            'hpe alletra',
            'hewlett packard enterprise',
            'hpe ilo',
            'integrated lights-out',
            'hpe oneview',
            'hpe storeonce'
        ],
        // Sub-products for display
        subProducts: [
            // Servers
            { id: 'proliant-dl380', name: 'ProLiant DL380', type: 'Rack Server', group: 'Servers', cpeMatch: [':proliant_dl380'], descMatch: ['proliant dl380'] },
            { id: 'proliant-dl360', name: 'ProLiant DL360', type: 'Rack Server', group: 'Servers', cpeMatch: [':proliant_dl360'], descMatch: ['proliant dl360'] },
            { id: 'proliant-ml350', name: 'ProLiant ML350', type: 'Tower Server', group: 'Servers', cpeMatch: [':proliant_ml350'], descMatch: ['proliant ml350'] },
            { id: 'ilo', name: 'iLO (Integrated Lights-Out)', type: 'Management', group: 'Management', cpeMatch: [':integrated_lights-out', ':ilo'], descMatch: ['integrated lights-out', 'ilo '] },
            // Storage
            { id: 'nimble', name: 'Nimble Storage', type: 'Storage', group: 'Storage', cpeMatch: [':nimble_storage', ':nimble'], descMatch: ['nimble storage', 'nimble '] },
            { id: 'alletra', name: 'Alletra', type: 'Storage', group: 'Storage', cpeMatch: [':alletra'], descMatch: ['alletra'] },
            { id: 'storeonce', name: 'StoreOnce', type: 'Backup', group: 'Storage', cpeMatch: [':storeonce'], descMatch: ['storeonce'] },
            // Management
            { id: 'oneview', name: 'OneView', type: 'Management', group: 'Management', cpeMatch: [':oneview'], descMatch: ['oneview'] }
        ]
    },

    // ==========================================
    // WatchGuard - Firewall & VPN
    // ==========================================
    {
        id: 'watchguard',
        name: 'WatchGuard',
        vendor: 'WatchGuard',
        category: ASSET_CATEGORIES.FIREWALL_VPN,
        vendorGroup: VENDOR_GROUPS.WATCHGUARD,
        description: 'WatchGuard Firebox firewalls and VPN solutions',
        cpeVendor: 'watchguard',
        cpeProducts: ['firebox', 'fireware', 'mobile_vpn', 'authpoint'],
        keywords: ['watchguard', 'firebox', 'fireware', 'watchguard vpn'],
        subProducts: [
            { id: 'firebox', name: 'Firebox', type: 'Firewall', cpeMatch: [':firebox'], descMatch: ['firebox'] },
            { id: 'fireware', name: 'Fireware OS', type: 'Software', cpeMatch: [':fireware'], descMatch: ['fireware'] },
            { id: 'mobile-vpn', name: 'Mobile VPN', type: 'VPN', cpeMatch: [':mobile_vpn'], descMatch: ['mobile vpn'] },
            { id: 'authpoint', name: 'AuthPoint', type: 'MFA', cpeMatch: [':authpoint'], descMatch: ['authpoint'] }
        ]
    },

    // ==========================================
    // Tripp Lite - Power & UPS
    // ==========================================
    {
        id: 'tripplite-ups',
        name: 'Tripp Lite UPS',
        vendor: 'Tripp Lite',
        category: ASSET_CATEGORIES.POWER,
        vendorGroup: VENDOR_GROUPS.TRIPP_LITE,
        description: 'Tripp Lite UPS and power management products',
        cpeVendor: 'tripp_lite',
        cpeProducts: ['smartpro', 'smart_online', 'smartonline', 'poweralert'],
        keywords: ['tripp lite'],
        preferKeywordSearch: true
    },

    // ==========================================
    // SolarWinds - IT Management
    // ==========================================
    {
        id: 'solarwinds',
        name: 'SolarWinds',
        vendor: 'SolarWinds',
        category: ASSET_CATEGORIES.IT_MANAGEMENT,
        vendorGroup: VENDOR_GROUPS.SOLARWINDS,
        description: 'SolarWinds IT management and monitoring platform',
        cpeVendor: 'solarwinds',
        cpeProducts: ['orion', 'orion_platform', 'network_performance_monitor', 'server_and_application_monitor'],
        keywords: ['solarwinds', 'orion platform', 'solarwinds npm', 'solarwinds sam']
    },

    // ==========================================
    // ConnectWise - IT Management
    // ==========================================
    {
        id: 'connectwise',
        name: 'ConnectWise',
        vendor: 'ConnectWise',
        category: ASSET_CATEGORIES.IT_MANAGEMENT,
        vendorGroup: VENDOR_GROUPS.CONNECTWISE,
        description: 'ConnectWise RMM and remote access tools',
        cpeVendor: 'connectwise',
        cpeProducts: ['screenconnect', 'automate', 'control', 'manage'],
        keywords: ['connectwise', 'screenconnect', 'connectwise automate', 'connectwise manage']
    },

    // ==========================================
    // Oracle - Database
    // ==========================================
    {
        id: 'oracle-database',
        name: 'Oracle Database',
        vendor: 'Oracle',
        category: ASSET_CATEGORIES.DATABASE,
        vendorGroup: VENDOR_GROUPS.ORACLE,
        description: 'Oracle Database and related products',
        cpeVendor: 'oracle',
        cpeProducts: ['database', 'database_server', 'enterprise_manager'],
        keywords: ['oracle database', 'oracle db', 'oracle enterprise manager']
    },

    // ==========================================
    // Veeam - Backup & DR
    // ==========================================
    {
        id: 'veeam',
        name: 'Veeam',
        vendor: 'Veeam',
        category: ASSET_CATEGORIES.BACKUP_DR,
        vendorGroup: VENDOR_GROUPS.VEEAM,
        description: 'Veeam backup and replication solutions',
        cpeVendor: 'veeam',
        cpeProducts: ['backup_and_replication', 'veeam_backup_\\&_replication', 'one', 'agent'],
        keywords: ['veeam'],
        preferKeywordSearch: true
    },

    // ==========================================
    // Zerto - Backup & DR
    // ==========================================
    {
        id: 'zerto',
        name: 'Zerto',
        vendor: 'Zerto',
        category: ASSET_CATEGORIES.BACKUP_DR,
        vendorGroup: VENDOR_GROUPS.ZERTO,
        description: 'Zerto disaster recovery and replication',
        cpeVendor: 'zerto',
        cpeProducts: ['virtual_replication', 'zerto'],
        keywords: ['zerto', 'zerto virtual replication']
    },

    // ==========================================
    // BitDefender - Security
    // ==========================================
    {
        id: 'bitdefender',
        name: 'BitDefender',
        vendor: 'BitDefender',
        category: ASSET_CATEGORIES.SECURITY,
        vendorGroup: VENDOR_GROUPS.BITDEFENDER,
        description: 'BitDefender endpoint security and GravityZone',
        cpeVendor: 'bitdefender',
        cpeProducts: ['gravityzone', 'endpoint_security', 'total_security'],
        keywords: ['bitdefender', 'gravityzone']
    },

    // ==========================================
    // Zoom - Collaboration
    // ==========================================
    {
        id: 'zoom',
        name: 'Zoom',
        vendor: 'Zoom Video Communications',
        category: ASSET_CATEGORIES.COLLABORATION,
        vendorGroup: VENDOR_GROUPS.ZOOM,
        description: 'Zoom video conferencing and collaboration',
        cpeVendor: 'zoom',
        cpeProducts: ['meetings', 'zoom', 'zoom_client', 'workplace', 'rooms'],
        keywords: ['zoom video communications', 'zoom meetings', 'zoom client']
    },

    // ==========================================
    // Google Chrome - Browsers
    // ==========================================
    {
        id: 'google-chrome',
        name: 'Google Chrome',
        vendor: 'Google',
        category: ASSET_CATEGORIES.BROWSERS,
        vendorGroup: VENDOR_GROUPS.GOOGLE,
        description: 'Google Chrome web browser',
        cpeVendor: 'google',
        cpeProducts: ['chrome'],
        keywords: ['google chrome', 'chrome browser']
    },

    // ==========================================
    // Firefox - Browsers
    // ==========================================
    {
        id: 'firefox',
        name: 'Firefox',
        vendor: 'Mozilla',
        category: ASSET_CATEGORIES.BROWSERS,
        vendorGroup: VENDOR_GROUPS.MOZILLA,
        description: 'Mozilla Firefox web browser',
        cpeVendor: 'mozilla',
        cpeProducts: ['firefox'],
        keywords: ['mozilla firefox', 'firefox browser']
    },

    // ==========================================
    // Crestron - AV & Control
    // ==========================================
    {
        id: 'crestron',
        name: 'Crestron',
        vendor: 'Crestron',
        category: ASSET_CATEGORIES.AV_CONTROL,
        vendorGroup: VENDOR_GROUPS.CRESTRON,
        description: 'Crestron AV and control systems',
        cpeVendor: 'crestron',
        cpeProducts: ['crestron', 'dm', 'nvx', 'flex'],
        keywords: ['crestron', 'crestron av', 'crestron control']
    },

    // ==========================================
    // LINUX DISTROS
    // ==========================================
    {
        id: 'ubuntu',
        name: 'Ubuntu',
        vendor: 'Canonical',
        category: ASSET_CATEGORIES.LINUX_DISTROS,
        vendorGroup: VENDOR_GROUPS.CANONICAL,
        description: 'Ubuntu Linux distribution',
        cpeVendor: 'canonical',
        cpeProducts: ['ubuntu_linux'],
        keywords: ['ubuntu', 'canonical ubuntu'],
        subProducts: [
            { id: 'ubuntu-server', name: 'Ubuntu Server', type: 'Server OS', cpeMatch: [':ubuntu_linux'], descMatch: ['ubuntu server'] },
            { id: 'ubuntu-desktop', name: 'Ubuntu Desktop', type: 'Desktop OS', cpeMatch: [':ubuntu_linux'], descMatch: ['ubuntu desktop'] }
        ]
    },
    {
        id: 'rhel',
        name: 'RHEL',
        vendor: 'Red Hat',
        category: ASSET_CATEGORIES.LINUX_DISTROS,
        vendorGroup: VENDOR_GROUPS.REDHAT,
        description: 'Red Hat Enterprise Linux',
        cpeVendor: 'redhat',
        cpeProducts: ['enterprise_linux', 'enterprise_linux_server'],
        keywords: ['red hat enterprise linux', 'rhel'],
        subProducts: [
            { id: 'rhel-server', name: 'RHEL Server', type: 'Server OS', cpeMatch: [':enterprise_linux_server', ':enterprise_linux'], descMatch: ['rhel server', 'enterprise linux server'] },
            { id: 'rhel-workstation', name: 'RHEL Workstation', type: 'Desktop OS', cpeMatch: [':enterprise_linux_workstation'], descMatch: ['rhel workstation', 'enterprise linux workstation'] }
        ]
    },
    {
        id: 'debian',
        name: 'Debian',
        vendor: 'Debian',
        category: ASSET_CATEGORIES.LINUX_DISTROS,
        vendorGroup: VENDOR_GROUPS.DEBIAN,
        description: 'Debian Linux distribution',
        cpeVendor: 'debian',
        cpeProducts: ['debian_linux'],
        keywords: ['debian linux', 'debian'],
        subProducts: [
            { id: 'debian-stable', name: 'Debian Stable', type: 'Server OS', cpeMatch: [':debian_linux'], descMatch: ['debian'] }
        ]
    },

    // ==========================================
    // CLOUD PLATFORMS
    // ==========================================
    {
        id: 'aws',
        name: 'AWS',
        vendor: 'Amazon',
        category: ASSET_CATEGORIES.CLOUD_PLATFORMS,
        vendorGroup: VENDOR_GROUPS.AMAZON,
        description: 'Amazon Web Services cloud platform',
        cpeVendor: 'amazon',
        cpeProducts: ['aws', 'linux', 'ec2', 's3'],
        keywords: ['amazon web services', 'aws', 'amazon linux'],
        subProducts: [
            { id: 'aws-ec2', name: 'EC2', type: 'Compute', cpeMatch: [':ec2'], descMatch: ['amazon ec2', 'aws ec2'] },
            { id: 'aws-s3', name: 'S3', type: 'Storage', cpeMatch: [':s3'], descMatch: ['amazon s3', 'aws s3'] },
            { id: 'amazon-linux', name: 'Amazon Linux', type: 'OS', cpeMatch: [':amazon:linux'], descMatch: ['amazon linux'] }
        ]
    },
    {
        id: 'azure-cloud',
        name: 'Azure Cloud',
        vendor: 'Microsoft',
        category: ASSET_CATEGORIES.CLOUD_PLATFORMS,
        vendorGroup: VENDOR_GROUPS.MICROSOFT,
        description: 'Microsoft Azure cloud services',
        cpeVendor: 'microsoft',
        cpeProducts: ['azure', 'azure_active_directory', 'azure_devops_server'],
        keywords: ['microsoft azure', 'azure cloud', 'azure active directory', 'azure devops'],
        subProducts: [
            { id: 'azure-ad', name: 'Azure AD / Entra ID', type: 'Identity', cpeMatch: [':azure_active_directory', ':entra_id'], descMatch: ['azure active directory', 'azure ad', 'entra id'] },
            { id: 'azure-devops', name: 'Azure DevOps', type: 'DevOps', cpeMatch: [':azure_devops'], descMatch: ['azure devops'] },
            { id: 'azure-platform', name: 'Azure Platform', type: 'Cloud', cpeMatch: [':microsoft:azure'], descMatch: ['microsoft azure'] }
        ]
    },
    {
        id: 'google-cloud',
        name: 'Google Cloud',
        vendor: 'Google',
        category: ASSET_CATEGORIES.CLOUD_PLATFORMS,
        vendorGroup: VENDOR_GROUPS.GOOGLE,
        description: 'Google Cloud Platform',
        cpeVendor: 'google',
        cpeProducts: ['cloud_platform', 'cloud_sdk'],
        keywords: ['google cloud platform', 'gcp', 'google cloud sdk'],
        subProducts: [
            { id: 'gcp-platform', name: 'GCP Platform', type: 'Cloud', cpeMatch: [':cloud_platform'], descMatch: ['google cloud platform', 'gcp'] },
            { id: 'gcp-sdk', name: 'Cloud SDK', type: 'Tooling', cpeMatch: [':cloud_sdk'], descMatch: ['google cloud sdk', 'cloud sdk'] }
        ]
    },

    // ==========================================
    // NETWORK SECURITY
    // ==========================================
    {
        id: 'fortinet',
        name: 'Fortinet',
        vendor: 'Fortinet',
        category: ASSET_CATEGORIES.NETWORK_SECURITY,
        vendorGroup: VENDOR_GROUPS.FORTINET,
        description: 'Fortinet network security products including FortiGate, FortiOS, FortiManager, and FortiAnalyzer',
        cpeVendor: 'fortinet',
        cpeProducts: ['fortigate', 'fortios', 'fortimanager', 'fortianalyzer'],
        keywords: ['fortinet', 'fortigate', 'fortios', 'fortimanager', 'fortianalyzer'],
        subProducts: [
            { id: 'fortigate', name: 'FortiGate', type: 'Firewall', cpeMatch: [':fortigate'], descMatch: ['fortigate'] },
            { id: 'fortios', name: 'FortiOS', type: 'Software', cpeMatch: [':fortios'], descMatch: ['fortios'] },
            { id: 'fortimanager', name: 'FortiManager', type: 'Management', cpeMatch: [':fortimanager'], descMatch: ['fortimanager'] },
            { id: 'fortianalyzer', name: 'FortiAnalyzer', type: 'Analytics', cpeMatch: [':fortianalyzer'], descMatch: ['fortianalyzer'] }
        ]
    },
    {
        id: 'paloalto',
        name: 'Palo Alto Networks',
        vendor: 'Palo Alto Networks',
        category: ASSET_CATEGORIES.NETWORK_SECURITY,
        vendorGroup: VENDOR_GROUPS.PALO_ALTO,
        description: 'Palo Alto Networks security products including PAN-OS, Cortex XDR, GlobalProtect, and Panorama',
        cpeVendor: 'paloaltonetworks',
        cpeProducts: ['pan-os', 'cortex_xdr', 'globalprotect', 'panorama'],
        keywords: ['palo alto networks', 'pan-os', 'cortex xdr', 'globalprotect', 'panorama'],
        subProducts: [
            { id: 'pan-os', name: 'PAN-OS', type: 'Software', cpeMatch: [':pan-os'], descMatch: ['pan-os'] },
            { id: 'cortex-xdr', name: 'Cortex XDR', type: 'XDR', cpeMatch: [':cortex_xdr'], descMatch: ['cortex xdr'] },
            { id: 'globalprotect', name: 'GlobalProtect', type: 'VPN', cpeMatch: [':globalprotect'], descMatch: ['globalprotect'] },
            { id: 'panorama', name: 'Panorama', type: 'Management', cpeMatch: [':panorama'], descMatch: ['panorama'] }
        ]
    },
    {
        id: 'juniper',
        name: 'Juniper',
        vendor: 'Juniper Networks',
        category: ASSET_CATEGORIES.NETWORK_SECURITY,
        vendorGroup: VENDOR_GROUPS.JUNIPER,
        description: 'Juniper Networks products including Junos OS, SRX, and MX series',
        cpeVendor: 'juniper',
        cpeProducts: ['junos', 'junos_os', 'srx', 'mx'],
        keywords: ['juniper networks', 'junos', 'juniper srx', 'juniper mx'],
        subProducts: [
            { id: 'junos', name: 'Junos OS', type: 'Software', cpeMatch: [':junos'], descMatch: ['junos'] },
            { id: 'srx', name: 'SRX Series', type: 'Firewall', cpeMatch: [':srx'], descMatch: ['srx series', 'juniper srx'] },
            { id: 'mx', name: 'MX Series', type: 'Router', cpeMatch: [':mx'], descMatch: ['mx series', 'juniper mx'] }
        ]
    },

    // ==========================================
    // CONTAINERS
    // ==========================================
    {
        id: 'docker',
        name: 'Docker',
        vendor: 'Docker',
        category: ASSET_CATEGORIES.CONTAINERS,
        vendorGroup: VENDOR_GROUPS.DOCKER,
        description: 'Docker container platform',
        cpeVendor: 'docker',
        cpeProducts: ['docker', 'docker_engine', 'docker_desktop'],
        keywords: ['docker', 'docker engine', 'docker desktop'],
        subProducts: [
            { id: 'docker-engine', name: 'Docker Engine', type: 'Runtime', cpeMatch: [':docker_engine', ':docker:docker'], descMatch: ['docker engine'] },
            { id: 'docker-desktop', name: 'Docker Desktop', type: 'Desktop App', cpeMatch: [':docker_desktop'], descMatch: ['docker desktop'] }
        ]
    },
    {
        id: 'kubernetes',
        name: 'Kubernetes',
        vendor: 'Kubernetes',
        category: ASSET_CATEGORIES.CONTAINERS,
        vendorGroup: VENDOR_GROUPS.KUBERNETES,
        description: 'Kubernetes container orchestration platform',
        cpeVendor: 'kubernetes',
        cpeProducts: ['kubernetes'],
        keywords: ['kubernetes', 'k8s'],
        subProducts: [
            { id: 'k8s-core', name: 'Kubernetes Core', type: 'Orchestrator', cpeMatch: [':kubernetes'], descMatch: ['kubernetes'] }
        ]
    }
];

// Get unique categories
export const getCategories = () => {
    return [...new Set(ASSETS.map(asset => asset.category))];
};

// Get assets by category
export const getAssetsByCategory = (category) => {
    if (!category || category === 'All') {
        return ASSETS;
    }
    return ASSETS.filter(asset => asset.category === category);
};

// Get asset by ID
export const getAssetById = (id) => {
    return ASSETS.find(asset => asset.id === id);
};

// Get all keywords for an asset (for API searching)
export const getAssetKeywords = (assetId) => {
    const asset = getAssetById(assetId);
    return asset ? asset.keywords : [];
};

// ============================================
// Vendor Grouping Helper Functions
// ============================================

// Get list of unique vendor groups that have assets
export const getVendorGroups = () => {
    const vendorGroups = [...new Set(ASSETS.map(asset => asset.vendorGroup))];
    return vendorGroups.filter(Boolean).sort();
};

// Get assets by vendor group
export const getAssetsByVendorGroup = (vendorGroup) => {
    if (!vendorGroup || vendorGroup === 'All') {
        return ASSETS;
    }
    return ASSETS.filter(asset => asset.vendorGroup === vendorGroup);
};

// Get subcategories for a vendor (based on asset categories within that vendor group)
export const getSubcategoriesForVendor = (vendorGroup) => {
    const vendorAssets = getAssetsByVendorGroup(vendorGroup);
    const subcategories = [...new Set(vendorAssets.map(asset => asset.category))];
    return subcategories.filter(Boolean).sort();
};

// Get assets by vendor and subcategory (category within a vendor group)
export const getAssetsByVendorAndSubcategory = (vendorGroup, subcategory) => {
    return ASSETS.filter(asset =>
        asset.vendorGroup === vendorGroup && asset.category === subcategory
    );
};

// Get vulnerability counts for a vendor group
export const getVendorVulnCounts = (vendorGroup, vulnCounts) => {
    const vendorAssets = getAssetsByVendorGroup(vendorGroup);
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    vendorAssets.forEach(asset => {
        const counts = vulnCounts[asset.id];
        if (counts) {
            total += counts.total || 0;
            critical += counts.critical || 0;
            high += counts.high || 0;
            medium += counts.medium || 0;
            low += counts.low || 0;
        }
    });

    return { total, critical, high, medium, low };
};

// Get vulnerability counts for a subcategory within a vendor
export const getSubcategoryVulnCounts = (vendorGroup, subcategory, vulnCounts) => {
    const assets = getAssetsByVendorAndSubcategory(vendorGroup, subcategory);
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    assets.forEach(asset => {
        const counts = vulnCounts[asset.id];
        if (counts) {
            total += counts.total || 0;
            critical += counts.critical || 0;
            high += counts.high || 0;
            medium += counts.medium || 0;
            low += counts.low || 0;
        }
    });

    return { total, critical, high, medium, low };
};

// Get sub-products for an asset (for drill-down view)
export const getSubProductsForAsset = (assetId) => {
    const asset = getAssetById(assetId);
    return asset?.subProducts || [];
};

// Get sub-products grouped by their group property
export const getGroupedSubProducts = (assetId) => {
    const subProducts = getSubProductsForAsset(assetId);
    const groups = {};

    subProducts.forEach(subProduct => {
        const groupName = subProduct.group || 'Other';
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(subProduct);
    });

    return groups;
};

// Helper to match a vulnerability to specific sub-products within a vendor
export const matchVulnToSubProducts = (vuln, asset) => {
    if (!asset?.subProducts) return [];

    const desc = vuln.description?.toLowerCase() || '';
    const cpes = vuln.affectedProducts?.map(p => p.cpe?.toLowerCase() || '') || [];

    const matchedSubProducts = [];

    asset.subProducts.forEach(subProduct => {
        let matched = false;

        // 1. CPE match (most reliable — structured NVD data)
        if (subProduct.cpeMatch) {
            matched = cpes.some(cpe =>
                subProduct.cpeMatch.some(pattern => cpe.includes(pattern))
            );
        }

        // 2. Description phrase match (fallback for CVEs without CPE data)
        if (!matched && subProduct.descMatch) {
            matched = subProduct.descMatch.some(phrase => desc.includes(phrase));
        }

        if (matched) {
            matchedSubProducts.push(subProduct);
        }
    });

    return matchedSubProducts;
};

export default ASSETS;

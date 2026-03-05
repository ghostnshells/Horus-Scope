import React, { useState, useMemo, useEffect } from 'react';
import { X, ArrowLeft, Calendar, Clock, ExternalLink, Shield, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Wrench, Code, Lightbulb, FileText, Link, Layers, Zap, Target, Skull, Users } from 'lucide-react';
import { matchVulnToSubProducts } from '../../data/assets';
import StatusBadge from '../Lifecycle/StatusBadge';
import SLAIndicator from '../Lifecycle/SLAIndicator';
import AuditTrail from '../Lifecycle/AuditTrail';
import './AlertsList.css';

const AlertsList = ({ asset, vulnerabilities = [], isOpen, onClose, isAuthenticated = false, slaConfig, vulnStatuses = {}, onStatusChange }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedProductSections, setExpandedProductSections] = useState({});
    const [statusFilter, setStatusFilter] = useState('all');
    const [criticalityFilter, setCriticalityFilter] = useState('all');
    const [epssFilter, setEpssFilter] = useState('all');

    // Reset filters when switching to a different asset
    useEffect(() => {
        setCriticalityFilter('all');
        setEpssFilter('all');
    }, [asset?.name]);

    // Group vulnerabilities by sub-product type (e.g., "Software", "Switch", "Storage")
    const groupedVulnerabilities = useMemo(() => {
        if (!asset?.subProducts || asset.subProducts.length === 0) {
            return null; // No grouping needed
        }

        const groups = {};
        const ungrouped = [];

        vulnerabilities.forEach(vuln => {
            const matchedSubProducts = matchVulnToSubProducts(vuln, asset);

            if (matchedSubProducts.length > 0) {
                // Group by the type of the first matched sub-product
                matchedSubProducts.forEach(subProduct => {
                    const groupKey = subProduct.type || 'Other';
                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            type: groupKey,
                            vulnerabilities: [],
                            subProductNames: new Set()
                        };
                    }
                    // Avoid duplicates within same group
                    if (!groups[groupKey].vulnerabilities.some(v => v.id === vuln.id)) {
                        groups[groupKey].vulnerabilities.push(vuln);
                    }
                    groups[groupKey].subProductNames.add(subProduct.name);
                });
            } else {
                // Couldn't match to any sub-product
                ungrouped.push(vuln);
            }
        });

        // Convert to array and sort by type
        const sortedGroups = Object.values(groups)
            .map(g => ({
                ...g,
                subProductNames: Array.from(g.subProductNames)
            }))
            .sort((a, b) => {
                // Software first, then alphabetically
                if (a.type === 'Software') return -1;
                if (b.type === 'Software') return 1;
                return a.type.localeCompare(b.type);
            });

        // Add ungrouped if any
        if (ungrouped.length > 0) {
            sortedGroups.push({
                type: 'Other',
                vulnerabilities: ungrouped,
                subProductNames: []
            });
        }

        return sortedGroups.length > 0 ? sortedGroups : null;
    }, [vulnerabilities, asset]);

    const toggleProductSection = (sectionType, e) => {
        e?.stopPropagation();
        setExpandedProductSections(prev => ({
            ...prev,
            [sectionType]: !prev[sectionType]
        }));
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        // Use UTC to avoid timezone conversion issues with NVD dates
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        });
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const toggleSection = (vulnId, section, e) => {
        e.stopPropagation();
        setExpandedSections(prev => ({
            ...prev,
            [`${vulnId}-${section}`]: !prev[`${vulnId}-${section}`]
        }));
    };

    const getSeverityClass = (severity) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL': return 'critical';
            case 'HIGH': return 'high';
            case 'MEDIUM': return 'medium';
            case 'LOW': return 'low';
            default: return 'unknown';
        }
    };

    const getEPSSClass = (score) => {
        if (score >= 0.5) return 'epss-critical';
        if (score >= 0.1) return 'epss-high';
        if (score >= 0.01) return 'epss-medium';
        return 'epss-low';
    };

    const categorizeReferences = (references) => {
        if (!references || !Array.isArray(references)) {
            return { exploits: [], patches: [], vendorAdvisories: [], mitigations: [], thirdParty: [], other: [] };
        }

        const specialTags = ['Exploit', 'Patch', 'Vendor Advisory', 'Mitigation', 'Third Party Advisory'];

        return {
            exploits: references.filter(r => r.tags?.includes('Exploit')),
            patches: references.filter(r => r.tags?.includes('Patch')),
            vendorAdvisories: references.filter(r => r.tags?.includes('Vendor Advisory')),
            mitigations: references.filter(r => r.tags?.includes('Mitigation')),
            thirdParty: references.filter(r => r.tags?.includes('Third Party Advisory')),
            other: references.filter(r => !r.tags?.some(tag => specialTags.includes(tag)))
        };
    };

    const getDueDateUrgency = (dueDate) => {
        if (!dueDate) return null;
        const due = new Date(dueDate);
        const now = new Date();
        const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) return 'overdue';
        if (daysUntilDue <= 7) return 'urgent';
        if (daysUntilDue <= 30) return 'upcoming';
        return 'normal';
    };

    const getSourceName = (url) => {
        try {
            const hostname = new URL(url).hostname.replace('www.', '');
            return hostname;
        } catch {
            return url;
        }
    };

    // Get contextual info about what a source typically provides
    const getSourceContext = (url) => {
        const hostname = getSourceName(url).toLowerCase();

        if (hostname.includes('github.com')) return { type: 'code', label: 'Code/PoC' };
        if (hostname.includes('exploit-db.com')) return { type: 'exploit', label: 'Exploit DB' };
        if (hostname.includes('packetstorm')) return { type: 'exploit', label: 'Exploit' };
        if (hostname.includes('microsoft.com')) return { type: 'vendor', label: 'Microsoft' };
        if (hostname.includes('oracle.com')) return { type: 'vendor', label: 'Oracle' };
        if (hostname.includes('cisco.com')) return { type: 'vendor', label: 'Cisco' };
        if (hostname.includes('apache.org')) return { type: 'vendor', label: 'Apache' };
        if (hostname.includes('mozilla.org')) return { type: 'vendor', label: 'Mozilla' };
        if (hostname.includes('chromium.org')) return { type: 'vendor', label: 'Chromium' };
        if (hostname.includes('nvd.nist.gov')) return { type: 'reference', label: 'NVD' };
        if (hostname.includes('cve.org') || hostname.includes('cve.mitre.org')) return { type: 'reference', label: 'CVE' };
        if (hostname.includes('redhat.com')) return { type: 'advisory', label: 'Red Hat' };
        if (hostname.includes('ubuntu.com')) return { type: 'advisory', label: 'Ubuntu' };
        if (hostname.includes('debian.org')) return { type: 'advisory', label: 'Debian' };
        if (hostname.includes('gentoo.org')) return { type: 'advisory', label: 'Gentoo' };
        if (hostname.includes('zerodayinitiative')) return { type: 'research', label: 'ZDI' };
        if (hostname.includes('tenable.com')) return { type: 'research', label: 'Tenable' };
        if (hostname.includes('rapid7.com')) return { type: 'research', label: 'Rapid7' };

        return { type: 'reference', label: null };
    };

    // Extract remediation summary from description and available data
    const generateRemediationSummary = (vuln, refs) => {
        const summary = {
            actions: [],
            keywords: []
        };

        const desc = vuln.description?.toLowerCase() || '';

        // Extract version-related remediation hints
        const versionPatterns = [
            /(?:update|upgrade)\s+to\s+(?:version\s+)?(\d+[\d.]+)/gi,
            /(?:fixed|patched)\s+in\s+(?:version\s+)?(\d+[\d.]+)/gi,
            /(?:versions?\s+)?(\d+[\d.]+)\s+(?:and\s+(?:later|above)|or\s+(?:later|higher))\s+(?:are\s+)?(?:not\s+)?(?:affected|vulnerable)/gi
        ];

        for (const pattern of versionPatterns) {
            const matches = vuln.description?.matchAll(pattern);
            for (const match of matches || []) {
                if (match[1]) {
                    summary.actions.push(`Update to version ${match[1]} or later`);
                }
            }
        }

        // Check for common remediation keywords in description
        if (desc.includes('disable') && (desc.includes('feature') || desc.includes('service') || desc.includes('functionality'))) {
            summary.actions.push('Consider disabling the affected feature if not needed');
        }
        if (desc.includes('firewall') || desc.includes('network segmentation')) {
            summary.actions.push('Apply network-level mitigations');
        }
        if (desc.includes('authentication') || desc.includes('credential')) {
            summary.keywords.push('authentication');
        }
        if (desc.includes('remote code execution') || desc.includes('rce')) {
            summary.keywords.push('RCE');
            summary.actions.push('Prioritize patching - remote code execution risk');
        }
        if (desc.includes('privilege escalation')) {
            summary.keywords.push('privilege escalation');
        }
        if (desc.includes('denial of service') || desc.includes('dos')) {
            summary.keywords.push('DoS');
        }

        // Add action based on available resources
        if (refs.patches.length > 0) {
            summary.actions.push(`Official patch available (${refs.patches.length} source${refs.patches.length > 1 ? 's' : ''})`);
        }
        if (refs.vendorAdvisories.length > 0) {
            summary.actions.push('Review vendor advisory for specific guidance');
        }

        // Deduplicate actions
        summary.actions = [...new Set(summary.actions)].slice(0, 4);
        summary.keywords = [...new Set(summary.keywords)];

        return summary;
    };

    // Extract PoC summary from description and exploit references
    const generatePocSummary = (vuln, refs) => {
        const summary = {
            riskLevel: 'unknown',
            attackVector: null,
            complexity: null,
            details: []
        };

        const desc = vuln.description?.toLowerCase() || '';

        // Determine attack vector
        if (desc.includes('remote') || desc.includes('network')) {
            summary.attackVector = 'Remote/Network';
            summary.riskLevel = 'high';
        } else if (desc.includes('local') || desc.includes('physical')) {
            summary.attackVector = 'Local Access Required';
            summary.riskLevel = 'medium';
        } else if (desc.includes('adjacent')) {
            summary.attackVector = 'Adjacent Network';
            summary.riskLevel = 'medium';
        }

        // Check for authentication requirements
        if (desc.includes('unauthenticated') || desc.includes('without authentication') || desc.includes('no authentication')) {
            summary.details.push('No authentication required');
            summary.riskLevel = 'critical';
        } else if (desc.includes('authenticated') || desc.includes('requires authentication')) {
            summary.details.push('Authentication required');
        }

        // Check for user interaction
        if (desc.includes('user interaction') || desc.includes('victim') || desc.includes('click') || desc.includes('social engineering')) {
            summary.details.push('User interaction needed');
        }

        // Exploit type indicators
        if (desc.includes('buffer overflow') || desc.includes('stack overflow') || desc.includes('heap overflow')) {
            summary.details.push('Memory corruption exploit');
        }
        if (desc.includes('sql injection') || desc.includes('sqli')) {
            summary.details.push('SQL Injection');
        }
        if (desc.includes('cross-site scripting') || desc.includes('xss')) {
            summary.details.push('XSS vulnerability');
        }
        if (desc.includes('command injection') || desc.includes('os command')) {
            summary.details.push('Command injection');
        }
        if (desc.includes('path traversal') || desc.includes('directory traversal')) {
            summary.details.push('Path traversal');
        }
        if (desc.includes('deserialization')) {
            summary.details.push('Insecure deserialization');
        }

        // Analyze exploit sources
        const githubExploits = refs.exploits.filter(r => r.url?.includes('github.com'));
        const exploitDbRefs = refs.exploits.filter(r => r.url?.includes('exploit-db.com'));

        if (githubExploits.length > 0) {
            summary.details.push(`${githubExploits.length} GitHub PoC${githubExploits.length > 1 ? 's' : ''} available`);
        }
        if (exploitDbRefs.length > 0) {
            summary.details.push('Listed on Exploit-DB');
        }

        // If actively exploited, mark as critical
        if (vuln.activelyExploited) {
            summary.riskLevel = 'critical';
            summary.details.unshift('Active exploitation in the wild');
        }

        summary.details = [...new Set(summary.details)].slice(0, 5);

        return summary;
    };

    // Check if there are any references to show
    const hasAnyReferences = (refs) => {
        return refs.exploits.length > 0 ||
               refs.patches.length > 0 ||
               refs.vendorAdvisories.length > 0 ||
               refs.mitigations.length > 0 ||
               refs.thirdParty.length > 0 ||
               refs.other.length > 0;
    };

    // Get all references combined for "All References" fallback
    const getAllReferences = (refs) => {
        return [
            ...refs.patches,
            ...refs.vendorAdvisories,
            ...refs.mitigations,
            ...refs.thirdParty,
            ...refs.other
        ];
    };

    // Generate NVD reference link for a CVE
    const getNvdLink = (cveId) => {
        if (!cveId || !cveId.startsWith('CVE-')) return null;
        return {
            url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
            source: 'NVD',
            tags: ['Reference']
        };
    };

    // Step 1: filter by status
    const statusFilteredVulns = useMemo(() => {
        if (statusFilter === 'all') return vulnerabilities;
        return vulnerabilities.filter(v => {
            const status = vulnStatuses[v.id]?.status || 'new';
            return status === statusFilter;
        });
    }, [vulnerabilities, statusFilter, vulnStatuses]);

    // Counts per severity level (based on status-filtered set, so buttons respond to status filter)
    const severityCounts = useMemo(() => {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        statusFilteredVulns.forEach(v => {
            const sev = v.severity?.toLowerCase();
            if (sev && Object.prototype.hasOwnProperty.call(counts, sev)) counts[sev]++;
        });
        return counts;
    }, [statusFilteredVulns]);

    // Step 2: filter by criticality
    const criticalityFilteredVulns = useMemo(() => {
        if (criticalityFilter === 'all') return statusFilteredVulns;
        return statusFilteredVulns.filter(v =>
            (v.severity?.toLowerCase() || '') === criticalityFilter
        );
    }, [statusFilteredVulns, criticalityFilter]);

    // EPSS tier counts (computed from criticality-filtered set so counts respond to severity filter)
    const epssCounts = useMemo(() => {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        criticalityFilteredVulns.forEach(v => {
            if (v.epssScore == null) return;
            if (v.epssScore >= 0.5) counts.critical++;
            else if (v.epssScore >= 0.1) counts.high++;
            else if (v.epssScore >= 0.01) counts.medium++;
            else counts.low++;
        });
        return counts;
    }, [criticalityFilteredVulns]);

    // Step 3: filter by EPSS tier
    const filteredVulnerabilities = useMemo(() => {
        if (epssFilter === 'all') return criticalityFilteredVulns;
        return criticalityFilteredVulns.filter(v => {
            if (v.epssScore == null) return false;
            switch (epssFilter) {
                case 'critical': return v.epssScore >= 0.5;
                case 'high': return v.epssScore >= 0.1 && v.epssScore < 0.5;
                case 'medium': return v.epssScore >= 0.01 && v.epssScore < 0.1;
                case 'low': return v.epssScore < 0.01;
                default: return true;
            }
        });
    }, [criticalityFilteredVulns, epssFilter]);

    // Helper function to render a vulnerability card (used by both grouped and flat views)
    const renderVulnerabilityCard = (vuln, refs, hasExploits, hasRemediation, dueDateUrgency, pocSummary, remediationSummary, allRefs) => (
        <div
            key={vuln.id}
            className={`alert-item ${expandedId === vuln.id ? 'expanded' : ''}`}
            onClick={() => toggleExpand(vuln.id)}
        >
            <div className="alert-item-header">
                <div className="alert-item-header-left">
                    <span className="alert-item-id">{vuln.id}</span>
                    <div className="alert-item-badges">
                        {vuln.activelyExploited && (
                            <span className="actively-exploited-badge">
                                <AlertTriangle size={12} />
                                Actively Exploited
                            </span>
                        )}
                        {vuln.cisaData?.knownRansomwareCampaignUse === 'Known' && (
                            <span className="ransomware-badge">
                                <Skull size={12} />
                                Ransomware
                            </span>
                        )}
                    </div>
                </div>
                <div className="alert-item-score">
                    {vuln.epssScore != null && (
                        <span className={`alert-item-epss ${getEPSSClass(vuln.epssScore)}`} title={`EPSS: ${(vuln.epssScore * 100).toFixed(1)}% probability of exploitation in next 30 days (${Math.round(vuln.epssPercentile * 100)}th percentile)`}>
                            <Zap size={10} />
                            EPSS {(vuln.epssScore * 100).toFixed(1)}%
                        </span>
                    )}
                    {vuln.cvssScore && (
                        <span className={`alert-item-cvss ${getSeverityClass(vuln.severity)}`}>
                            CVSS {vuln.cvssScore.toFixed(1)}
                        </span>
                    )}
                    <span className={`badge badge-${getSeverityClass(vuln.severity)}`}>
                        {vuln.severity || 'Unknown'}
                    </span>
                </div>
            </div>

            <div className="alert-item-lifecycle">
                <StatusBadge
                    cveId={vuln.id}
                    currentStatus={vulnStatuses[vuln.id]?.status || 'new'}
                    onStatusChange={onStatusChange}
                    isAuthenticated={isAuthenticated}
                />
                <SLAIndicator
                    publishedDate={vuln.published}
                    severity={vuln.severity}
                    status={vulnStatuses[vuln.id]?.status || 'new'}
                    slaConfig={slaConfig}
                />
            </div>

            <p className="alert-item-description">
                {vuln.description}
            </p>

            <div className="alert-item-meta">
                <span className="alert-item-meta-item">
                    <Calendar />
                    Published: {formatDate(vuln.published)}
                </span>
                <span className="alert-item-meta-item">
                    <Clock />
                    NVD Updated: {formatDate(vuln.lastModified)}
                </span>
            </div>

            {expandedId === vuln.id && (
                <>
                    {/* ATT&CK Techniques */}
                    {vuln.attackTechniques && vuln.attackTechniques.length > 0 && (
                        <div className="attack-techniques">
                            <Target size={12} />
                            {vuln.attackTechniques.map((tech, idx) => (
                                <a
                                    key={idx}
                                    href={`https://attack.mitre.org/techniques/${tech.id}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="attack-technique-badge"
                                    onClick={(e) => e.stopPropagation()}
                                    title={tech.name}
                                >
                                    {tech.id}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Threat Actor Association */}
                    {vuln.threatActors && vuln.threatActors.length > 0 && (
                        <div className="threat-actors">
                            <Users size={12} />
                            {vuln.threatActors.map((actor, idx) => (
                                <span
                                    key={idx}
                                    className="threat-actor-badge"
                                    title={`Source: ${actor.source}`}
                                >
                                    {actor.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Audit Trail */}
                    <AuditTrail cveId={vuln.id} isAuthenticated={isAuthenticated} />

                    {/* Proof of Concept Section */}
                    {hasExploits && (
                        <div className="alert-section poc-section">
                            <div
                                className="alert-section-header"
                                onClick={(e) => toggleSection(vuln.id, 'poc', e)}
                            >
                                <div className="alert-section-title">
                                    {expandedSections[`${vuln.id}-poc`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Code size={14} />
                                    Proof of Concept
                                    <span className="alert-section-count">{refs.exploits.length}</span>
                                </div>
                            </div>
                            {expandedSections[`${vuln.id}-poc`] && (
                                <div className="alert-section-content">
                                    {pocSummary && (pocSummary.attackVector || pocSummary.details.length > 0) && (
                                        <div className="summary-box poc-summary">
                                            <div className="summary-header">
                                                <Lightbulb size={14} />
                                                <span>Exploit Analysis</span>
                                                {pocSummary.riskLevel !== 'unknown' && (
                                                    <span className={`risk-badge risk-${pocSummary.riskLevel}`}>
                                                        {pocSummary.riskLevel.toUpperCase()} RISK
                                                    </span>
                                                )}
                                            </div>
                                            <ul className="summary-list">
                                                {pocSummary.attackVector && (
                                                    <li><strong>Attack Vector:</strong> {pocSummary.attackVector}</li>
                                                )}
                                                {pocSummary.details.map((detail, idx) => (
                                                    <li key={idx}>{detail}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="ref-category">
                                        <div className="ref-category-title">Exploit Resources</div>
                                        {refs.exploits.map((ref, idx) => {
                                            const sourceCtx = getSourceContext(ref.url);
                                            return (
                                                <a
                                                    key={idx}
                                                    href={ref.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="alert-item-reference poc-link"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink size={10} />
                                                    <span className="ref-source">{getSourceName(ref.url)}</span>
                                                    {sourceCtx.label && (
                                                        <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>
                                                    )}
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Remediation Guide Section */}
                    {hasRemediation && (
                        <div className="alert-section remediation-section">
                            <div
                                className="alert-section-header"
                                onClick={(e) => toggleSection(vuln.id, 'remediation', e)}
                            >
                                <div className="alert-section-title">
                                    {expandedSections[`${vuln.id}-remediation`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Wrench size={14} />
                                    Remediation Guide
                                </div>
                            </div>
                            {expandedSections[`${vuln.id}-remediation`] && (
                                <div className="alert-section-content">
                                    {remediationSummary.actions.length > 0 && (
                                        <div className="summary-box remediation-summary">
                                            <div className="summary-header">
                                                <Lightbulb size={14} />
                                                <span>Recommended Actions</span>
                                            </div>
                                            <ul className="summary-list actionable">
                                                {remediationSummary.actions.map((action, idx) => (
                                                    <li key={idx}>{action}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {vuln.cisaData?.requiredAction && (
                                        <div className="cisa-action">
                                            <div className="cisa-action-label">CISA Required Action</div>
                                            <p className="cisa-action-text">{vuln.cisaData.requiredAction}</p>
                                        </div>
                                    )}
                                    {vuln.cisaData?.dueDate && (
                                        <div className={`cisa-due-date ${dueDateUrgency}`}>
                                            <Calendar size={12} />
                                            <span>Remediation Due: {formatDate(vuln.cisaData.dueDate)}</span>
                                            {dueDateUrgency === 'overdue' && <span className="urgency-label">OVERDUE</span>}
                                            {dueDateUrgency === 'urgent' && <span className="urgency-label">URGENT</span>}
                                        </div>
                                    )}
                                    {refs.patches.length > 0 && (
                                        <div className="ref-category">
                                            <div className="ref-category-title">Patches</div>
                                            {refs.patches.map((ref, idx) => {
                                                const sourceCtx = getSourceContext(ref.url);
                                                return (
                                                    <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference patch-link" onClick={(e) => e.stopPropagation()}>
                                                        <ExternalLink size={10} />
                                                        <span className="ref-source">{getSourceName(ref.url)}</span>
                                                        {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {refs.vendorAdvisories.length > 0 && (
                                        <div className="ref-category">
                                            <div className="ref-category-title">Vendor Advisories</div>
                                            {refs.vendorAdvisories.map((ref, idx) => {
                                                const sourceCtx = getSourceContext(ref.url);
                                                return (
                                                    <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                                        <ExternalLink size={10} />
                                                        <span className="ref-source">{getSourceName(ref.url)}</span>
                                                        {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {refs.mitigations.length > 0 && (
                                        <div className="ref-category">
                                            <div className="ref-category-title">Mitigations</div>
                                            {refs.mitigations.map((ref, idx) => {
                                                const sourceCtx = getSourceContext(ref.url);
                                                return (
                                                    <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                                        <ExternalLink size={10} />
                                                        <span className="ref-source">{getSourceName(ref.url)}</span>
                                                        {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {refs.thirdParty.length > 0 && (
                                        <div className="ref-category">
                                            <div className="ref-category-title">Third Party Advisories</div>
                                            {refs.thirdParty.map((ref, idx) => {
                                                const sourceCtx = getSourceContext(ref.url);
                                                return (
                                                    <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                                        <ExternalLink size={10} />
                                                        <span className="ref-source">{getSourceName(ref.url)}</span>
                                                        {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* All References Section */}
                    {!hasExploits && !hasRemediation && (allRefs.length > 0 || vuln.id?.startsWith('CVE-')) && (
                        <div className="alert-section">
                            <div className="alert-section-header" onClick={(e) => toggleSection(vuln.id, 'refs', e)}>
                                <div className="alert-section-title">
                                    {expandedSections[`${vuln.id}-refs`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Link size={14} />
                                    References
                                    <span className="alert-section-count">{allRefs.length || 1}</span>
                                </div>
                            </div>
                            {expandedSections[`${vuln.id}-refs`] && (
                                <div className="alert-section-content">
                                    {allRefs.length > 0 ? (
                                        <>
                                            {allRefs.slice(0, 10).map((ref, idx) => {
                                                const sourceCtx = getSourceContext(ref.url);
                                                return (
                                                    <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                                        <ExternalLink size={10} />
                                                        <span className="ref-source">{getSourceName(ref.url)}</span>
                                                        {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                                    </a>
                                                );
                                            })}
                                            {allRefs.length > 10 && <div className="ref-more">+{allRefs.length - 10} more references</div>}
                                        </>
                                    ) : (
                                        <a href={`https://nvd.nist.gov/vuln/detail/${vuln.id}`} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                            <ExternalLink size={10} />
                                            <span className="ref-source">nvd.nist.gov</span>
                                            <span className="source-badge source-reference">NVD</span>
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Other References */}
                    {(hasExploits || hasRemediation) && refs.other.length > 0 && (
                        <div className="alert-section">
                            <div className="alert-section-header" onClick={(e) => toggleSection(vuln.id, 'other', e)}>
                                <div className="alert-section-title">
                                    {expandedSections[`${vuln.id}-other`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <FileText size={14} />
                                    Additional References
                                    <span className="alert-section-count">{refs.other.length}</span>
                                </div>
                            </div>
                            {expandedSections[`${vuln.id}-other`] && (
                                <div className="alert-section-content">
                                    {refs.other.slice(0, 10).map((ref, idx) => {
                                        const sourceCtx = getSourceContext(ref.url);
                                        return (
                                            <a key={idx} href={ref.url} target="_blank" rel="noopener noreferrer" className="alert-item-reference" onClick={(e) => e.stopPropagation()}>
                                                <ExternalLink size={10} />
                                                <span className="ref-source">{getSourceName(ref.url)}</span>
                                                {sourceCtx.label && <span className={`source-badge source-${sourceCtx.type}`}>{sourceCtx.label}</span>}
                                            </a>
                                        );
                                    })}
                                    {refs.other.length > 10 && <div className="ref-more">+{refs.other.length - 10} more references</div>}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );

    return (
        <>
            <div
                className={`alerts-overlay ${isOpen ? 'visible' : ''}`}
                onClick={onClose}
            />
            <div className={`alerts-panel ${isOpen ? 'open' : ''}`}>
                <div className="alerts-panel-header">
                    <div className="alerts-panel-title-group">
                        <button className="alerts-panel-back" onClick={onClose} aria-label="Close panel">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="alerts-panel-title">{asset?.name || 'Vulnerabilities'}</h2>
                            <p className="alerts-panel-subtitle">
                                {filteredVulnerabilities.length} of {vulnerabilities.length} {vulnerabilities.length === 1 ? 'vulnerability' : 'vulnerabilities'}
                                {statusFilter !== 'all' && ` · ${statusFilter.replace('_', ' ')}`}
                                {criticalityFilter !== 'all' && ` · ${criticalityFilter.charAt(0).toUpperCase() + criticalityFilter.slice(1)} severity`}
                                {epssFilter !== 'all' && ` · EPSS ${epssFilter.charAt(0).toUpperCase() + epssFilter.slice(1)}`}
                            </p>
                        </div>
                    </div>
                    <div className="alerts-panel-actions">
                        {isAuthenticated && (
                            <select
                                className="status-filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="all">All Statuses</option>
                                <option value="new">New</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="in_progress">In Progress</option>
                                <option value="patched">Patched</option>
                                <option value="mitigated">Mitigated</option>
                                <option value="accepted_risk">Accepted Risk</option>
                                <option value="false_positive">False Positive</option>
                            </select>
                        )}
                        <button className="alerts-panel-close" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Severity Filter Bar */}
                <div className="criticality-filter-bar">
                    <span className="filter-bar-label"><Shield size={12} /> Severity</span>
                    <button
                        className={`criticality-filter-btn ${criticalityFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setCriticalityFilter('all')}
                    >
                        All
                        <span className="criticality-filter-count">{statusFilteredVulns.length}</span>
                    </button>
                    {[
                        { key: 'critical', label: 'Critical' },
                        { key: 'high', label: 'High' },
                        { key: 'medium', label: 'Medium' },
                        { key: 'low', label: 'Low' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={`criticality-filter-btn ${key} ${criticalityFilter === key ? 'active' : ''} ${severityCounts[key] === 0 ? 'empty' : ''}`}
                            onClick={() => setCriticalityFilter(key)}
                            disabled={severityCounts[key] === 0}
                        >
                            {label}
                            <span className="criticality-filter-count">{severityCounts[key]}</span>
                        </button>
                    ))}
                </div>

                {/* EPSS Exploit Likelihood Filter Bar */}
                <div className="criticality-filter-bar epss-filter-bar">
                    <span className="filter-bar-label"><Zap size={12} /> Exploit Likelihood</span>
                    <button
                        className={`criticality-filter-btn ${epssFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setEpssFilter('all')}
                    >
                        All
                        <span className="criticality-filter-count">{criticalityFilteredVulns.length}</span>
                    </button>
                    {[
                        { key: 'critical', label: 'Critical' },
                        { key: 'high', label: 'High' },
                        { key: 'medium', label: 'Medium' },
                        { key: 'low', label: 'Low' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={`criticality-filter-btn ${key} ${epssFilter === key ? 'active' : ''} ${epssCounts[key] === 0 ? 'empty' : ''}`}
                            onClick={() => setEpssFilter(key)}
                            disabled={epssCounts[key] === 0}
                        >
                            {label}
                            <span className="criticality-filter-count">{epssCounts[key]}</span>
                        </button>
                    ))}
                </div>

                <div className="alerts-list">
                    {filteredVulnerabilities.length === 0 ? (
                        <div className="alerts-empty">
                            <CheckCircle2 />
                            <h3 className="alerts-empty-title">No vulnerabilities</h3>
                            <p className="alerts-empty-text">
                                {epssFilter !== 'all'
                                    ? `No vulnerabilities with ${epssFilter} exploit likelihood found.`
                                    : criticalityFilter !== 'all'
                                    ? `No ${criticalityFilter} severity vulnerabilities found.`
                                    : vulnerabilities.length > 0 && statusFilter !== 'all'
                                    ? 'No vulnerabilities match the selected status filter.'
                                    : 'No known vulnerabilities found for this asset in the selected time range.'}
                            </p>
                        </div>
                    ) : groupedVulnerabilities && statusFilter === 'all' && criticalityFilter === 'all' && epssFilter === 'all' ? (
                        /* Grouped display by product/software type */
                        groupedVulnerabilities.map(group => (
                            <div key={group.type} className="product-section">
                                <div
                                    className="product-section-header"
                                    onClick={(e) => toggleProductSection(group.type, e)}
                                >
                                    <div className="product-section-title">
                                        {expandedProductSections[group.type] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <Layers size={16} />
                                        <span>{group.type}</span>
                                        <span className="product-section-count">{group.vulnerabilities.length}</span>
                                    </div>
                                    {group.subProductNames.length > 0 && (
                                        <div className="product-section-subtitle">
                                            {group.subProductNames.slice(0, 3).join(', ')}
                                            {group.subProductNames.length > 3 && ` +${group.subProductNames.length - 3} more`}
                                        </div>
                                    )}
                                </div>
                                {expandedProductSections[group.type] && (
                                    <div className="product-section-content">
                                        {group.vulnerabilities.map(vuln => {
                                            const refs = categorizeReferences(vuln.references);
                                            const hasExploits = refs.exploits.length > 0;
                                            const hasRemediation = refs.patches.length > 0 || refs.vendorAdvisories.length > 0 || refs.mitigations.length > 0 || refs.thirdParty.length > 0 || vuln.cisaData;
                                            const dueDateUrgency = getDueDateUrgency(vuln.cisaData?.dueDate);
                                            const pocSummary = hasExploits ? generatePocSummary(vuln, refs) : null;
                                            const remediationSummary = generateRemediationSummary(vuln, refs);
                                            const allRefs = getAllReferences(refs);

                                            return renderVulnerabilityCard(vuln, refs, hasExploits, hasRemediation, dueDateUrgency, pocSummary, remediationSummary, allRefs);
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        /* Flat list display (no sub-products, or filtered view) */
                        filteredVulnerabilities.map(vuln => {
                            const refs = categorizeReferences(vuln.references);
                            const hasExploits = refs.exploits.length > 0;
                            const hasRemediation = refs.patches.length > 0 || refs.vendorAdvisories.length > 0 || refs.mitigations.length > 0 || refs.thirdParty.length > 0 || vuln.cisaData;
                            const dueDateUrgency = getDueDateUrgency(vuln.cisaData?.dueDate);
                            const pocSummary = hasExploits ? generatePocSummary(vuln, refs) : null;
                            const remediationSummary = generateRemediationSummary(vuln, refs);
                            const allRefs = getAllReferences(refs);

                            return renderVulnerabilityCard(vuln, refs, hasExploits, hasRemediation, dueDateUrgency, pocSummary, remediationSummary, allRefs);
                        })
                    )}
                </div>
            </div>
        </>
    );
};

export default AlertsList;

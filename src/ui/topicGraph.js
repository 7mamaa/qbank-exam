import { i18n } from '../core/i18n.js?v=16.6.1';
import { state } from '../core/state.js?v=16.6.1';
import { Helpers } from '../utils/helpers.js?v=16.6.1';
import { app } from '../../app.js?v=16.6.1';

/**
 * @module TopicGraph
 * @description Zero-dependency HTML5 Canvas Topic Network Visualizer with elastic force physics simulation.
 */
export const TopicGraph = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    nodes: [],
    edges: [],
    selectedNode: null,
    hoveredNode: null,
    draggedNode: null,
    isPlaying: true,
    scope: 'all', // 'all' or 'filtered'
    groupType: 'tags', // 'tags' or 'categories'
    width: 600,
    height: 600,
    handlers: null,

    /**
     * Initializes the visualizer module.
     * @param {HTMLCanvasElement} canvasEl 
     */
    init(canvasEl) {
        if (!canvasEl) return;
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.isPlaying = true;
        this.selectedNode = null;
        this.hoveredNode = null;
        this.draggedNode = null;
        
        // Initial setup and bindings
        this.resize(true); // Force resize layout setup
        this.setupEvents();
        this.startSimulation();
    },

    /**
     * Resizes the canvas to match high DPI displays without clearing data or jumping nodes.
     * @param {boolean} force - Force resize even if dimensions are identical
     */
    resize(force = false) {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const w = rect.width || 600;
        const h = rect.height || 500;
        if (w === 0 || h === 0) return;
        
        // Only run resize if size actually changed to avoid layout thrashing/flash
        if (!force && Math.abs(this.width - w) < 2 && Math.abs(this.height - h) < 2) {
            return;
        }

        // Capture relative coordinates of existing nodes to preserve layout
        const oldW = this.width || 600;
        const oldH = this.height || 600;
        this.nodes.forEach(node => {
            node.rx = node.x / oldW;
            node.ry = node.y / oldH;
        });
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        
        this.ctx.scale(dpr, dpr);
        this.width = w;
        this.height = h;

        // Restore absolute coordinates based on new dimensions
        this.nodes.forEach(node => {
            if (typeof node.rx === 'number' && !isNaN(node.rx)) {
                node.x = node.rx * w;
                node.y = node.ry * h;
            }
        });
    },

    /**
     * Setup canvas event listeners for mouse and touch interactions.
     */
    setupEvents() {
        if (!this.canvas) return;
        
        // Clean up previous event handlers
        if (this.handlers) {
            this.canvas.removeEventListener('mousemove', this.handlers.mousemove);
            this.canvas.removeEventListener('mousedown', this.handlers.mousedown);
            this.canvas.removeEventListener('mouseup', this.handlers.mouseup);
            this.canvas.removeEventListener('mouseleave', this.handlers.mouseleave);
            this.canvas.removeEventListener('touchstart', this.handlers.touchstart);
            this.canvas.removeEventListener('touchmove', this.handlers.touchmove);
            this.canvas.removeEventListener('touchend', this.handlers.touchend);
        }

        this.handlers = {
            mousemove: this.onMouseMove.bind(this),
            mousedown: this.onMouseDown.bind(this),
            mouseup: this.onMouseUp.bind(this),
            mouseleave: this.onMouseLeave.bind(this),
            touchstart: this.onTouchStart.bind(this),
            touchmove: this.onTouchMove.bind(this),
            touchend: this.onTouchEnd.bind(this)
        };

        this.canvas.addEventListener('mousemove', this.handlers.mousemove);
        this.canvas.addEventListener('mousedown', this.handlers.mousedown);
        this.canvas.addEventListener('mouseup', this.handlers.mouseup);
        this.canvas.addEventListener('mouseleave', this.handlers.mouseleave);
        
        // Touch supports for mobile viewports
        this.canvas.addEventListener('touchstart', this.handlers.touchstart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handlers.touchmove, { passive: false });
        this.canvas.addEventListener('touchend', this.handlers.touchend);
        
        // Debounced window resize handler
        if (!this._resizeHandler) {
            let resizeTimeout;
            this._resizeHandler = () => {
                if (state.currentView === 'topic-graph') {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        this.resize();
                    }, 150);
                }
            };
            window.addEventListener('resize', this._resizeHandler);
        }
    },

    /**
     * Helper to get mouse coordinates relative to the canvas.
     */
    getMousePos(e) {
        if (!this.canvas) return { x: 0, y: 0 };
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

    /**
     * Helper to get touch coordinates relative to the canvas.
     */
    getTouchPos(e) {
        if (!this.canvas || !e.touches || e.touches.length === 0) return { x: 0, y: 0 };
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    },

    /**
     * Finds a node under the mouse or touch coordinate.
     */
    findNodeAt(pos) {
        const isMobile = window.innerWidth <= 768;
        const pad = isMobile ? 25 : 15; // Larger tap target on mobile screens
        return this.nodes.find(node => {
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            return dx * dx + dy * dy <= (node.r + pad) * (node.r + pad);
        });
    },

    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.draggedNode) {
            const border = this.draggedNode.r + 15;
            this.draggedNode.x = Math.max(border, Math.min(this.width - border, pos.x));
            this.draggedNode.y = Math.max(border, Math.min(this.height - border, pos.y));
            this.draggedNode.vx = 0;
            this.draggedNode.vy = 0;
            return;
        }

        const node = this.findNodeAt(pos);
        if (node !== this.hoveredNode) {
            this.hoveredNode = node;
            this.canvas.style.cursor = node ? 'pointer' : 'default';

            if (!this.selectedNode) {
                if (node) {
                    this.showNodeDetails(node);
                } else {
                    this.hideNodeDetails();
                }
            }
        }
    },

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        const node = this.findNodeAt(pos);
        if (node) {
            this.draggedNode = node;
            this.selectedNode = node;
            this.showNodeDetails(node);
        } else {
            this.selectedNode = null;
            this.hideNodeDetails();
        }
    },

    onMouseUp() {
        this.draggedNode = null;
    },

    onMouseLeave() {
        this.draggedNode = null;
        this.hoveredNode = null;
    },

    // Touch Interaction Event Handlers
    onTouchStart(e) {
        const pos = this.getTouchPos(e);
        const node = this.findNodeAt(pos);
        if (node) {
            if (e.cancelable) e.preventDefault();
            this.draggedNode = node;
            this.selectedNode = node;
            this.showNodeDetails(node);
        } else {
            this.selectedNode = null;
            this.hideNodeDetails();
        }
    },

    onTouchMove(e) {
        if (!this.draggedNode) return;
        if (e.cancelable) e.preventDefault();
        const pos = this.getTouchPos(e);
        const border = this.draggedNode.r + 10;
        this.draggedNode.x = Math.max(border, Math.min(this.width - border, pos.x));
        this.draggedNode.y = Math.max(border, Math.min(this.height - border, pos.y));
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
    },

    onTouchEnd() {
        this.draggedNode = null;
    },

    /**
     * Builds nodes and edges from the question dataset.
     */
    buildGraph(questions) {
        const nodeMap = new Map();
        const edgeMap = new Map();

        const getDiffValue = (diff) => {
            if (diff === 'easy') return 1;
            if (diff === 'medium') return 2;
            if (diff === 'hard') return 3;
            return 0;
        };

        const list = questions || [];

        list.forEach(q => {
            let topics = [];
            if (this.groupType === 'tags') {
                topics = q.tags || [];
            } else {
                if (q.category && q.category.trim()) {
                    topics = [q.category.trim()];
                }
            }

            const uniqueTopics = [...new Set(topics.map(t => t.trim()).filter(Boolean))];

            uniqueTopics.forEach(topic => {
                if (!nodeMap.has(topic)) {
                    nodeMap.set(topic, {
                        id: topic,
                        name: topic,
                        count: 0,
                        totalDifficulty: 0,
                        difficultyCount: 0,
                        easyCount: 0,
                        mediumCount: 0,
                        hardCount: 0,
                        questions: []
                    });
                }
                const n = nodeMap.get(topic);
                n.count++;
                n.questions.push(q);

                const diffVal = getDiffValue(q.difficulty);
                if (diffVal > 0) {
                    n.totalDifficulty += diffVal;
                    n.difficultyCount++;
                }
                if (q.difficulty === 'easy') n.easyCount++;
                else if (q.difficulty === 'medium') n.mediumCount++;
                else if (q.difficulty === 'hard') n.hardCount++;
            });

            if (uniqueTopics.length > 1) {
                for (let i = 0; i < uniqueTopics.length; i++) {
                    for (let j = i + 1; j < uniqueTopics.length; j++) {
                        const tA = uniqueTopics[i];
                        const tB = uniqueTopics[j];
                        const key = tA < tB ? `${tA}|||${tB}` : `${tB}|||${tA}`;
                        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
                    }
                }
            }
        });

        const newNodes = [];
        const oldNodePositions = new Map(this.nodes.map(n => [n.id, { x: n.x, y: n.y }]));
        const isMobile = window.innerWidth <= 768;
        const scaleFactor = Math.min(1, this.width / 600);

        nodeMap.forEach((data, id) => {
            const oldPos = oldNodePositions.get(id);
            // Dynamic larger nodes on mobile screens to facilitate tapping
            const minR = isMobile ? (16 * scaleFactor) : 12;
            const maxR = isMobile ? (30 * scaleFactor) : 30;
            const r = Math.max(minR, Math.min(maxR, ((isMobile ? 10 : 8) + data.count * 1.2) * scaleFactor));
            const x = oldPos ? oldPos.x : (this.width / 2) + (Math.random() - 0.5) * 150;
            const y = oldPos ? oldPos.y : (this.height / 2) + (Math.random() - 0.5) * 150;

            let avgDiff = 0;
            if (data.difficultyCount > 0) {
                avgDiff = data.totalDifficulty / data.difficultyCount;
            }

            let color = '#888888';
            let diffLabel = i18n.t ? i18n.t('q_not_defined') : 'غير محدد';
            
            if (data.difficultyCount > 0) {
                if (avgDiff <= 1.5) {
                    color = '#2cb67d';
                    diffLabel = i18n.t ? i18n.t('difficulty_easy') : 'سهل';
                } else if (avgDiff <= 2.5) {
                    color = '#f4a261';
                    diffLabel = i18n.t ? i18n.t('difficulty_medium') : 'متوسط';
                } else {
                    color = '#e63946';
                    diffLabel = i18n.t ? i18n.t('difficulty_hard') : 'صعب';
                }
            }

            newNodes.push({
                ...data,
                x,
                y,
                vx: 0,
                vy: 0,
                r,
                color,
                avgDiff,
                diffLabel
            });
        });

        const newEdges = [];
        edgeMap.forEach((weight, key) => {
            const [tA, tB] = key.split('|||');
            const sourceNode = newNodes.find(n => n.id === tA);
            const targetNode = newNodes.find(n => n.id === tB);
            if (sourceNode && targetNode) {
                newEdges.push({
                    source: sourceNode,
                    target: targetNode,
                    weight
                });
            }
        });

        this.nodes = newNodes;
        this.edges = newEdges;

        const statsSummary = document.getElementById('graph-stats-summary');
        if (statsSummary) {
            statsSummary.textContent = `${this.nodes.length} عقدة | ${this.edges.length} رابط`;
        }

        // Keep selection updated if node is still present
        if (this.selectedNode) {
            const freshSelected = this.nodes.find(n => n.id === this.selectedNode.id);
            if (freshSelected) {
                this.selectedNode = freshSelected;
                this.showNodeDetails(freshSelected);
            } else {
                this.selectedNode = null;
                this.hideNodeDetails();
            }
        }
    },

    /**
     * Physics math simulation loop with mathematical security checks and damping.
     */
    tickSimulation() {
        if (!this.isPlaying) return;

        const nodes = this.nodes;
        const edges = this.edges;
        const n = nodes.length;
        if (n === 0) return;

        const isMobile = window.innerWidth <= 768;
        const repulsion = isMobile ? 300 : 500; 
        const spring = isMobile ? 0.04 : 0.05;   
        const gravity = isMobile ? 0.05 : 0.04;   
        const damping = isMobile ? 0.76 : 0.82;   
        const minDistance = isMobile ? 50 : 65; 

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // 1. Node Repulsion (Math guarded to prevent divide-by-zero or overlap explosion)
        for (let i = 0; i < n; i++) {
            const nodeA = nodes[i];
            if (nodeA === this.draggedNode) continue;

            for (let j = i + 1; j < n; j++) {
                const nodeB = nodes[j];

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distSq = dx * dx + dy * dy;
                
                // Law of protection against zero
                const dist = Math.sqrt(distSq) || 0.1;
                const safeDistSq = Math.max(0.1, distSq);

                const force = repulsion / safeDistSq;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (nodeA !== this.draggedNode) {
                    nodeA.vx -= fx;
                    nodeA.vy -= fy;
                }
                if (nodeB !== this.draggedNode) {
                    nodeB.vx += fx;
                    nodeB.vy += fy;
                }
            }
        }

        // 2. Spring Attraction along Edges
        edges.forEach(edge => {
            const nodeA = edge.source;
            const nodeB = edge.target;

            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

            const force = (dist - minDistance) * spring;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (nodeA !== this.draggedNode) {
                nodeA.vx += fx;
                nodeA.vy += fy;
            }
            if (nodeB !== this.draggedNode) {
                nodeB.vx -= fx;
                nodeB.vy -= fy;
            }
        });

        // 3. Central Gravity, Clamping & Boundary Restrictions
        nodes.forEach(node => {
            if (node === this.draggedNode) return;

            const dx = centerX - node.x;
            const dy = centerY - node.y;

            node.vx += dx * gravity;
            node.vy += dy * gravity;

            // Force Clamping: limit maximum speed to prevent explosion
            const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy) || 0.1;
            const maxSpeed = 12;
            if (speed > maxSpeed) {
                node.vx = (node.vx / speed) * maxSpeed;
                node.vy = (node.vy / speed) * maxSpeed;
            }

            node.x += node.vx;
            node.y += node.vy;

            // Safe recovery boundaries to prevent NaN coordinates
            if (isNaN(node.x) || !isFinite(node.x)) node.x = centerX + (Math.random() - 0.5) * 50;
            if (isNaN(node.y) || !isFinite(node.y)) node.y = centerY + (Math.random() - 0.5) * 50;
            if (isNaN(node.vx)) node.vx = 0;
            if (isNaN(node.vy)) node.vy = 0;

            node.vx *= damping;
            node.vy *= damping;

            const border = node.r + (isMobile ? 12 : 15);
            node.x = Math.max(border, Math.min(this.width - border, node.x));
            node.y = Math.max(border, Math.min(this.height - border, node.y));
        });
    },

    /**
     * Render graph onto HTML5 canvas.
     */
    draw() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.width, this.height);
        const isMobile = window.innerWidth <= 768;

        // Draw edges with clean styling and contrast
        this.edges.forEach(edge => {
            let opacity = 0.15;
            if (this.selectedNode || this.hoveredNode) {
                const active = this.selectedNode || this.hoveredNode;
                if (edge.source === active || edge.target === active) {
                    opacity = 0.8;
                    ctx.lineWidth = isMobile ? 2 : 2.5;
                } else {
                    opacity = 0.03;
                    ctx.lineWidth = isMobile ? 0.6 : 1;
                }
            } else {
                ctx.lineWidth = isMobile ? 1 : 1.5;
            }

            ctx.strokeStyle = `rgba(128, 128, 128, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(edge.source.x, edge.source.y);
            ctx.lineTo(edge.target.x, edge.target.y);
            ctx.stroke();
        });

        // Draw nodes
        this.nodes.forEach(node => {
            let opacity = 1;
            let strokeColor = 'rgba(255, 255, 255, 0.4)';
            let strokeWidth = 1.2;

            if (this.selectedNode || this.hoveredNode) {
                const active = this.selectedNode || this.hoveredNode;
                const isNeighbor = this.edges.some(edge => 
                    (edge.source === node && edge.target === active) || 
                    (edge.target === node && edge.source === active)
                );

                if (node === active) {
                    opacity = 1;
                    strokeColor = '#ffffff';
                    strokeWidth = 3;
                } else if (isNeighbor) {
                    opacity = 0.85;
                    strokeColor = 'rgba(255, 255, 255, 0.6)';
                    strokeWidth = 1.8;
                } else {
                    opacity = 0.22;
                    strokeColor = 'rgba(255, 255, 255, 0.08)';
                }
            }

            // Outer glow highlight for selection
            if (node === this.selectedNode) {
                ctx.shadowColor = node.color;
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowBlur = 0;
            }

            // Fill node circle
            ctx.fillStyle = node.color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.fill();

            // Stroke node circle
            ctx.shadowBlur = 0; 
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.stroke();

            // Responsive typography style for node labels
            ctx.font = node === this.selectedNode 
                ? (isMobile ? 'bold 13px sans-serif' : 'bold 12px sans-serif') 
                : (isMobile ? '500 11px sans-serif' : '500 10px sans-serif');
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(node.name, node.x, node.y + node.r + 5);
        });
    },

    /**
     * Start animation frame loop.
     */
    startSimulation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const run = () => {
            this.tickSimulation();
            this.draw();
            this.animationFrameId = requestAnimationFrame(run);
        };
        this.animationFrameId = requestAnimationFrame(run);
    },

    /**
     * Update node details inside the visual sidebar panel.
     */
    showNodeDetails(node) {
        const panelEmpty = document.getElementById('graph-panel-empty');
        const panelDetails = document.getElementById('graph-panel-details');
        if (!panelEmpty || !panelDetails) return;

        panelEmpty.style.display = 'none';
        panelDetails.style.display = 'flex';

        document.getElementById('graph-node-name').textContent = node.name;
        document.getElementById('graph-node-count').textContent = node.count;
        document.getElementById('graph-node-difficulty').textContent = node.diffLabel;
        document.getElementById('graph-node-difficulty').style.color = node.color;

        const total = node.count;
        const easyPct = total > 0 ? (node.easyCount / total) * 100 : 0;
        const mediumPct = total > 0 ? (node.mediumCount / total) * 100 : 0;
        const hardPct = total > 0 ? (node.hardCount / total) * 100 : 0;

        document.getElementById('graph-bar-easy').style.width = `${easyPct}%`;
        document.getElementById('graph-bar-medium').style.width = `${mediumPct}%`;
        document.getElementById('graph-bar-hard').style.width = `${hardPct}%`;

        document.getElementById('graph-txt-easy').textContent = node.easyCount;
        document.getElementById('graph-txt-medium').textContent = node.mediumCount;
        document.getElementById('graph-txt-hard').textContent = node.hardCount;

        const qListContainer = document.getElementById('graph-node-questions');
        if (qListContainer) {
            qListContainer.innerHTML = '';
            node.questions.slice(0, 15).forEach((q, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'background:var(--surface-color); padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); font-size:0.75rem; color:var(--text-body); cursor:pointer; font-weight:600; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s ease; margin-bottom: 5px;';
                
                const badgeColor = q.difficulty === 'easy' ? '#2cb67d' : (q.difficulty === 'medium' ? '#f4a261' : '#e63946');
                const diffTxt = i18n.t ? i18n.t('difficulty_' + q.difficulty) : q.difficulty;

                item.innerHTML = `
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:75%;" title="${Helpers.sanitize(q.question)}">${idx + 1}. ${Helpers.sanitize(q.question)}</span>
                    <span style="background:${badgeColor}; color:#000; font-size:0.65rem; padding:1px 6px; border-radius:4px; font-weight:bold; flex-shrink: 0;">${diffTxt}</span>
                `;

                item.onclick = (e) => {
                    e.stopPropagation();
                    app.editQuestion(q.id);
                };

                qListContainer.appendChild(item);
            });
        }
    },

    /**
     * Restores info panel back to default blank state.
     */
    hideNodeDetails() {
        const panelEmpty = document.getElementById('graph-panel-empty');
        const panelDetails = document.getElementById('graph-panel-details');
        if (!panelEmpty || !panelDetails) return;

        panelEmpty.style.display = 'flex';
        panelDetails.style.display = 'none';
    },

    /**
     * Clears loop references and removes DOM listeners.
     */
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        const canvas = this.canvas;
        if (canvas && this.handlers) {
            canvas.removeEventListener('mousemove', this.handlers.mousemove);
            canvas.removeEventListener('mousedown', this.handlers.mousedown);
            canvas.removeEventListener('mouseup', this.handlers.mouseup);
            canvas.removeEventListener('mouseleave', this.handlers.mouseleave);
            canvas.removeEventListener('touchstart', this.handlers.touchstart);
            canvas.removeEventListener('touchmove', this.handlers.touchmove);
            canvas.removeEventListener('touchend', this.handlers.touchend);
        }

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }

        this.selectedNode = null;
        this.hoveredNode = null;
        this.draggedNode = null;
        this.handlers = null;
    }
};

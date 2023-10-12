/** @odoo-module */

import { Component, useRef, onPatched } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { scrollTo } from "@web/core/utils/scrolling";

import { HierarchyCard } from "./hierarchy_card";
import { useHierarchyNodeDraggable } from "../../hooks/hierarchy_node_draggable";

export class HierarchyRenderer extends Component {
    static components = {
        HierarchyCard,
    };
    static props = {
        model: Object,
        openRecord: Function,
        archInfo: Object,
        templates: Object,
    };
    static template = "hr_org_chart.HierarchyRenderer";

    setup() {
        this.rendererRef = useRef("renderer");
        this.notification = useService("notification");
        if (this.canDragAndDropRecord) {
            useHierarchyNodeDraggable({
                ref: this.rendererRef,
                enable: this.draggable,
                elements: ".o_hierarchy_node_container",
                handle: ".o_hierarchy_node",
                rows: ".o_hierarchy_row",
                ignore: "button",
                onDragStart: ({ addClass, element }) => {
                    addClass(element, "o_hierarchy_dragged");
                    addClass(element.querySelector(".o_hierarchy_node"), "shadow");
                },
                onDragEnd: ({ removeClass, element, row, hierarchyRow }) => {
                    removeClass(element, "o_hierarchy_dragged");
                    if (row) {
                        removeClass(row, "o_hierarchy_hover");
                    }
                    if (hierarchyRow) {
                        removeClass(hierarchyRow, "o_hierarchy_hover");
                    }
                },
                onDrop: (params) => {
                    this.nodeDrop(params);
                },
                onElementEnter: ({ addClass, element }) => {
                    addClass(element, "o_hierarchy_hover");
                },
                onElementLeave: ({ removeClass, element }) => {
                    removeClass(element, "o_hierarchy_hover");
                },
                onRowEnter: ({ addClass, row }) => {
                    addClass(row, "o_hierarchy_hover");
                },
                onRowLeave: ({ removeClass, row }) => {
                    removeClass(row, "o_hierarchy_hover");
                },
            });
        }
        onPatched(this.onPatched);
    }

    onPatched() {
        const row = this.rendererRef.el.querySelector(":scope .o_hierarchy_row:last-child");
        if (row) {
            const scrollable = this.env.isSmall ? document.querySelector(".o_hierarchy_view") : this.rendererRef.el.parentNode;
            scrollable.classList.add(".o_hierarchy_auto-scroll");
            scrollTo(row, { scrollable, isAnchor: true });
            scrollable.classList.remove(".o_hierarchy_auto-scroll");
        }
    }

    get canDragAndDropRecord() {
        return this.draggable && !this.env.isSmall;
    }

    get draggable() {
        return this.props.archInfo.draggable;
    }

    get rows() {
        const rootNodes = this.props.model.root.rootNodes;
        const rows = [{ nodes: rootNodes }];
        const processNode = (node) => {
            if (!node.isLeaf) {
                rows.push({ parentNode: node, nodes: node.nodes});
                for (const subNode of node.nodes) {
                    processNode(subNode);
                }
            }
        };

        for (const node of this.props.model.root.rootNodes) {
            processNode(node);
        }

        return rows;
    }

    async nodeDrop({ element, row, nextRow, newParentNode }) {
        let parentNodeId, parentResId;
        if (newParentNode) {
            parentNodeId = newParentNode.dataset.nodeId;
        } else if (nextRow?.dataset.rowId !== row.dataset.rowId) {
            parentNodeId = nextRow.dataset.parentNodeId;
            if (!parentNodeId) {
                const nodes = this.rows[nextRow.dataset.rowId].nodes || [];
                if (nodes) {
                    parentNodeId = nodes[0].parentNode?.id;
                    if (!parentNodeId) {
                        parentResId = nodes[0].parentResId;
                        if (!nodes.every((node) => node.parentResId === parentResId)) {
                            this.notification.add(
                                _t("Impossible to update the parent node of the dragged node because no parent has been found."),
                                {
                                    type: "danger",
                                }
                            );
                            return;
                        }
                    }
                }
            }
        }
        await this.props.model.updateParentNode(element.dataset.nodeId, { parentResId, parentNodeId });
    }
}

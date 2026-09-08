import MarkdownBlock from './blocks/MarkdownBlock.vue'
import LineChartBlock from './blocks/LineChartBlock.vue'
import BarChartBlock from './blocks/BarChartBlock.vue'
import TableBlock from './blocks/TableBlock.vue'
import KpiBlock from './blocks/KpiBlock.vue'

export const sentinelBlockRegistry = {
  markdown: MarkdownBlock,
  'line-chart': LineChartBlock,
  'bar-chart': BarChartBlock,
  table: TableBlock,
  kpi: KpiBlock,
} as const

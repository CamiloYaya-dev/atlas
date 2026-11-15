// Single acceptance threshold; never modify actual coverage counters.
export const COVERAGE_TARGET=90
export const COVERAGE_METRICS=['lines','statements','functions','branches']
export function coveragePercent(metric){
 if(!metric||!Number.isSafeInteger(metric.total)||!Number.isSafeInteger(metric.covered)||metric.total<0||metric.covered<0||metric.covered>metric.total)return null
 return metric.total===0?100:100*metric.covered/metric.total
}

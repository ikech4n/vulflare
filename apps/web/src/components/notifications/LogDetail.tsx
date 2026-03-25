import type { NotificationLog } from "@vulflare/shared/types";

function parsePayload(payloadStr: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadStr);
    return parsed.data ?? parsed;
  } catch {
    return {};
  }
}

export function LogDetail({ log }: { log: NotificationLog }) {
  const data = parsePayload(log.payload);

  if (log.event_type === "eol_approaching" || log.event_type === "eol_expired") {
    const name = data.display_name as string | undefined;
    const cycle = data.cycle as string | undefined;
    const eolDate = data.eol_date as string | undefined;
    const daysUntil = data.days_until_eol as number | undefined;
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
        {name && (
          <div>
            <span className="font-medium">{name}</span>
            {cycle ? ` (${cycle})` : ""}
          </div>
        )}
        {eolDate && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            EOL: {eolDate}
            {daysUntil != null ? ` (残 ${daysUntil}日)` : ""}
          </div>
        )}
      </div>
    );
  }

  if (log.event_type.startsWith("vulnerability_")) {
    const title = data.title as string | undefined;
    const vulnId = data.vuln_id as string | undefined;
    const severity = data.severity as string | undefined;
    const cvss = data.cvss_score as number | undefined;
    const createdCount = data.created_count as number | undefined;
    const updatedCount = data.updated_count as number | undefined;
    const criticalCount = data.critical_count as number | undefined;
    const cveIds = data.cve_ids as string[] | undefined;
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
        {(vulnId || title) && (
          <div>
            <span className="font-medium">{vulnId}</span>
            {title ? ` ${title}` : ""}
          </div>
        )}
        {createdCount != null && (
          <div>
            {createdCount}件登録{criticalCount ? `（Critical: ${criticalCount}件）` : ""}
          </div>
        )}
        {updatedCount != null && (
          <div>
            {updatedCount}件更新{updatedCount > 20 ? "（上位20件表示）" : ""}
          </div>
        )}
        {cveIds?.length ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">CVE: {cveIds.join(", ")}</div>
        ) : null}
        {(severity || cvss != null) && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {severity}
            {cvss != null ? ` CVSS: ${cvss}` : ""}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">-</span>;
}

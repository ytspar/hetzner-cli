import { colorize, createTable, info } from "../shared/formatter.js";
import type { DiffResult, PriceChange } from "./diff.js";
import type { StoredSnapshot } from "./store.js";
import type { AuctionServer } from "./types.js";

function serverRow(s: AuctionServer): string[] {
  return [
    s.id.toString(),
    s.cpu,
    `${s.ram_size} GB${s.is_ecc ? " ECC" : ""}`,
    s.datacenter,
    `€${s.price.toFixed(2)}`,
  ];
}

function formatPriceChange(change: PriceChange): string[] {
  const s = change.server;
  const delta = s.price - change.previousPrice;
  const sign = delta > 0 ? "+" : "";
  const deltaStr = `${sign}${delta.toFixed(2)}`;
  const colored =
    delta < 0 ? colorize(deltaStr, "green") : colorize(deltaStr, "red");

  return [
    s.id.toString(),
    s.cpu,
    `${s.ram_size} GB${s.is_ecc ? " ECC" : ""}`,
    s.datacenter,
    `€${change.previousPrice.toFixed(2)} → €${s.price.toFixed(2)} (${colored})`,
  ];
}

export function formatDiff(
  diff: DiffResult,
  previous: StoredSnapshot,
  current: StoredSnapshot
): string {
  const totalChanges =
    diff.added.length + diff.removed.length + diff.priceChanged.length;

  if (totalChanges === 0) {
    return info(
      `No changes detected (${current.serverCount} servers, snapshot #${current.id})`
    );
  }

  const lines: string[] = [];

  lines.push(
    colorize(`Auction diff: snapshot #${previous.id} → #${current.id}`, "bold")
  );
  lines.push(
    colorize(
      `  ${previous.serverCount} → ${current.serverCount} servers | ${diff.added.length} added, ${diff.removed.length} removed, ${diff.priceChanged.length} price changes`,
      "dim"
    )
  );
  lines.push("");

  if (diff.added.length > 0) {
    lines.push(colorize(`+ ${diff.added.length} new server(s)`, "green"));
    const table = createTable(["ID", "CPU", "RAM", "DC", "Price"]);
    for (const s of diff.added) {
      table.push(serverRow(s));
    }
    lines.push(table.toString());
    lines.push("");
  }

  if (diff.removed.length > 0) {
    lines.push(colorize(`- ${diff.removed.length} removed server(s)`, "red"));
    const table = createTable(["ID", "CPU", "RAM", "DC", "Price"]);
    for (const s of diff.removed) {
      table.push(serverRow(s));
    }
    lines.push(table.toString());
    lines.push("");
  }

  if (diff.priceChanged.length > 0) {
    lines.push(
      colorize(`~ ${diff.priceChanged.length} price change(s)`, "yellow")
    );
    const table = createTable(["ID", "CPU", "RAM", "DC", "Price Change"]);
    for (const change of diff.priceChanged) {
      table.push(formatPriceChange(change));
    }
    lines.push(table.toString());
  }

  return lines.join("\n");
}

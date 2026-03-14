import { escapeHtml } from "./terminal.ts";

const h = escapeHtml;

function styled(text: string, cls: string): string {
  return `<span class="${cls}">${h(text)}</span>`;
}

function cyan(text: string) {
  return styled(text, "c-cyan");
}
function dim(text: string) {
  return styled(text, "c-dim");
}
function bold(text: string) {
  return styled(text, "c-bold");
}
function green(text: string) {
  return styled(text, "c-green");
}
function yellow(text: string) {
  return styled(text, "c-yellow");
}

export function getMainHelp(): string {
  return `<pre class="table-output">${bold("hetzner-cli")} ${dim("v2.4.0")} — Unified CLI for Hetzner Robot & Cloud API

${cyan("USAGE")}
  ${dim("$")} hetzner ${dim("<command>")} ${dim("[options]")}

${cyan("COMMANDS")}
  ${green("auction")}          Browse Hetzner Server Auction
  ${green("cloud")}            Manage Hetzner Cloud resources
  ${green("server")}           Manage Robot dedicated servers
  ${green("key")}              Manage SSH keys (Robot)

${cyan("META")}
  ${green("help")}             Show this help message
  ${green("version")}          Show version number
  ${green("clear")}            Clear terminal output

${cyan("EXAMPLES")}
  ${dim("$")} hetzner auction list
  ${dim("$")} hetzner auction list --max-price 50 --cpu epyc --sort ram
  ${dim("$")} hetzner cloud server list
  ${dim("$")} hetzner server list

Run ${yellow("hetzner <command> --help")} for command-specific help.</pre>`;
}

export function getAuctionHelp(): string {
  return `<pre class="table-output">${bold("hetzner auction")} — Browse Hetzner Server Auction

${cyan("COMMANDS")}
  ${green("list")} ${dim("(ls)")}        List auction servers with filters
  ${green("show")} ${dim("<id>")}        Show detailed server information

Run ${yellow("hetzner auction list --help")} for filter options.</pre>`;
}

export function getAuctionListHelp(): string {
  return `<pre class="table-output">${bold("hetzner auction list")} — List auction servers

${cyan("FILTERS")}
  ${green("--min-price")} ${dim("<n>")}       Minimum monthly price (EUR)
  ${green("--max-price")} ${dim("<n>")}       Maximum monthly price (EUR)
  ${green("--min-ram")} ${dim("<n>")}         Minimum RAM in GB
  ${green("--max-ram")} ${dim("<n>")}         Maximum RAM in GB
  ${green("--cpu")} ${dim("<text>")}          Filter by CPU model (partial match)
  ${green("--datacenter")} ${dim("<text>")}   Filter by datacenter (partial match)
  ${green("--disk-type")} ${dim("<type>")}    Filter by disk type: NVMe, SATA SSD, HDD
  ${green("--search")} ${dim("<text>")}       Search across all text fields

${cyan("FLAGS")}
  ${green("--ecc")}                 Only ECC RAM servers
  ${green("--gpu")}                 Only GPU servers
  ${green("--inic")}                Only servers with iNIC
  ${green("--fixed-price")}         Only fixed-price servers
  ${green("--auction-only")}        Only auction (non-fixed) servers
  ${green("--no-setup-fee")}        Only servers without setup fee

${cyan("DISPLAY")}
  ${green("--sort")} ${dim("<field>")}        Sort by: price, ram, cpu, datacenter, id
  ${green("--desc")}                Sort descending
  ${green("--limit")} ${dim("<n>")}           Limit results
  ${green("--json")}                Output as JSON

${cyan("EXAMPLES")}
  ${dim("$")} hetzner auction list --gpu
  ${dim("$")} hetzner auction list --max-price 50 --sort ram --desc
  ${dim("$")} hetzner auction list --cpu epyc --min-ram 256
  ${dim("$")} hetzner auction list --datacenter FSN --disk-type NVMe</pre>`;
}

export function getCloudHelp(): string {
  return `<pre class="table-output">${bold("hetzner cloud")} — Manage Hetzner Cloud resources

${cyan("COMMANDS")}
  ${green("server")}          Manage cloud servers
  ${green("network")}         Manage networks
  ${green("firewall")}        Manage firewalls
  ${green("volume")}          Manage volumes

Run ${yellow("hetzner cloud <resource> --help")} for more details.</pre>`;
}

export function getCloudServerHelp(): string {
  return `<pre class="table-output">${bold("hetzner cloud server")} — Manage cloud servers

${cyan("COMMANDS")}
  ${green("list")}              List all cloud servers
  ${green("describe")} ${dim("<name|id>")}  Show server details

${cyan("EXAMPLES")}
  ${dim("$")} hetzner cloud server list
  ${dim("$")} hetzner cloud server describe web-prod-1
  ${dim("$")} hetzner cloud server describe 42917324</pre>`;
}

export function getCloudNetworkHelp(): string {
  return `<pre class="table-output">${bold("hetzner cloud network")} — Manage networks

${cyan("COMMANDS")}
  ${green("list")}              List all networks
  ${green("describe")} ${dim("<id>")}      Show network details</pre>`;
}

export function getCloudFirewallHelp(): string {
  return `<pre class="table-output">${bold("hetzner cloud firewall")} — Manage firewalls

${cyan("COMMANDS")}
  ${green("list")}              List all firewalls
  ${green("describe")} ${dim("<id>")}      Show firewall details</pre>`;
}

export function getCloudVolumeHelp(): string {
  return `<pre class="table-output">${bold("hetzner cloud volume")} — Manage volumes

${cyan("COMMANDS")}
  ${green("list")}              List all volumes
  ${green("describe")} ${dim("<id>")}      Show volume details</pre>`;
}

export function getServerHelp(): string {
  return `<pre class="table-output">${bold("hetzner server")} — Manage Robot dedicated servers

${cyan("COMMANDS")}
  ${green("list")}              List all dedicated servers
  ${green("get")} ${dim("<id>")}           Show server details

${cyan("EXAMPLES")}
  ${dim("$")} hetzner server list
  ${dim("$")} hetzner server get 1284751</pre>`;
}

export function getKeyHelp(): string {
  return `<pre class="table-output">${bold("hetzner key")} — Manage SSH keys (Robot)

${cyan("COMMANDS")}
  ${green("list")}              List all SSH keys</pre>`;
}

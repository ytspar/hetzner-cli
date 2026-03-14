import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { error, success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import {
  formatCertificateDetails,
  formatCertificateList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerCertificateCommands(parent: Command): void {
  const cert = parent
    .command("certificate")
    .description("Certificate management");

  cert
    .command("list")
    .alias("ls")
    .description("List all certificates")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-s, --sort <field>", "Sort by field")
    .option("--type <type>", "Filter by type (uploaded, managed)")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            labelSelector?: string;
            sort?: string;
            type?: string;
          }
        ) => {
          const certs = await client.listCertificates({
            label_selector: options.labelSelector,
            sort: options.sort,
            type: options.type,
          });
          output(certs, formatCertificateList, options);
        }
      )
    );

  cert
    .command("describe <id-or-name>")
    .description("Show certificate details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "certificate", (name) =>
            client.listCertificates({ name })
          );
          const certificate = await client.getCertificate(id);
          output(certificate, formatCertificateDetails, options);
        }
      )
    );

  cert
    .command("create")
    .description("Create a certificate")
    .requiredOption("--name <name>", "Certificate name")
    .option("--type <type>", "Certificate type (uploaded, managed)", "uploaded")
    .option("--cert-file <path>", "Path to certificate PEM file (for uploaded)")
    .option("--key-file <path>", "Path to private key PEM file (for uploaded)")
    .option("--domain <domains...>", "Domain names (for managed)")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            name: string;
            type?: string;
            certFile?: string;
            keyFile?: string;
            domain?: string[];
          }
        ) => {
          const createOpts: {
            name: string;
            type?: "uploaded" | "managed";
            certificate?: string;
            private_key?: string;
            domain_names?: string[];
          } = {
            name: options.name,
            type: options.type as "uploaded" | "managed",
          };
          if (options.type === "managed") {
            if (!options.domain || options.domain.length === 0) {
              console.error(error("Managed certificates require --domain"));
              process.exit(1);
            }
            createOpts.domain_names = options.domain;
          } else {
            if (!(options.certFile && options.keyFile)) {
              console.error(
                error(
                  "Uploaded certificates require --cert-file and --key-file"
                )
              );
              process.exit(1);
            }
            createOpts.certificate = readFileSync(options.certFile, "utf-8");
            createOpts.private_key = readFileSync(options.keyFile, "utf-8");
          }
          const { certificate: created } =
            await client.createCertificate(createOpts);
          console.log(
            success(`Certificate '${created.name}' created (ID: ${created.id})`)
          );
        }
      )
    );

  cert
    .command("delete <id-or-name>")
    .description("Delete a certificate")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "certificate", (name) =>
            client.listCertificates({ name })
          );
          const certificate = await client.getCertificate(id);
          if (
            !(await confirmAction(
              `Delete certificate '${certificate.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteCertificate(id);
          console.log(
            success(`Certificate '${certificate.name}' (ID: ${id}) deleted.`)
          );
        }
      )
    );

  cert
    .command("update <id-or-name>")
    .description("Update certificate")
    .option("--name <name>", "New name")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "certificate", (name) =>
            client.listCertificates({ name })
          );
          await client.updateCertificate(id, { name: options.name });
          console.log(success(`Certificate ${id} updated.`));
        }
      )
    );

  cert
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "certificate", (name) =>
          client.listCertificates({ name })
        );
        const certificate = await client.getCertificate(id);
        const [key, value] = label.split("=");
        await client.updateCertificate(id, {
          labels: { ...certificate.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  cert
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "certificate", (name) =>
          client.listCertificates({ name })
        );
        const certificate = await client.getCertificate(id);
        const labels = Object.fromEntries(
          Object.entries(certificate.labels).filter(([k]) => k !== key)
        );
        await client.updateCertificate(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}

import type { FieldInfo } from "geoassist-hazard-proximity/core";

const quote = (values: string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * The live layer schema as text for the model: one line per field with its
 * type and real values. For coded fields the list is complete, which is what
 * lets the validator refuse a value that isn't in the layer.
 */
export function describeSchema(schema: FieldInfo[]): string {
  return schema
    .map((field) => {
      let line = `- ${field.name} (${field.type})`;
      if (field.all_values) line += ` all values: ${quote(field.examples)}`;
      else if (field.examples.length) line += ` e.g. ${quote(field.examples)}`;
      for (const [name, group] of Object.entries(field.value_groups ?? {})) {
        line += `\n  group ${name}: ${field.name} IN (${quote(group.values)}). ${group.description}`;
      }
      return line;
    })
    .join("\n");
}

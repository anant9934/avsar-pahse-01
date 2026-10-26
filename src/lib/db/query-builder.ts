/**
 * Safe Parameterized SQL Query Builder
 * 
 * Generates SQL queries with strictly bound parameterized placeholders ($1, $2, ...)
 * to eliminate SQL injection vulnerabilities without the overhead of heavy ORMs.
 */

export interface BuiltQuery {
  text: string;
  values: unknown[];
}

export class ParameterizedQueryBuilder {
  private selectedFields: string[] = ["*"];
  private tableName: string = "";
  private whereConditions: string[] = [];
  private queryValues: unknown[] = [];
  private orderClauses: string[] = [];
  private limitCount: number | null = null;
  private offsetCount: number | null = null;

  /**
   * Specifies fields to select. Validates column identifier safety.
   */
  select(fields: string | string[]): this {
    if (Array.isArray(fields)) {
      this.selectedFields = fields.map((f) => this.sanitizeIdentifier(f));
    } else {
      this.selectedFields = fields.split(",").map((f) => this.sanitizeIdentifier(f.trim()));
    }
    return this;
  }

  /**
   * Sets target table.
   */
  from(table: string): this {
    this.tableName = this.sanitizeIdentifier(table);
    return this;
  }

  /**
   * Adds an equality condition: `column = $N`
   */
  whereEq(column: string, value: unknown): this {
    const sanitizedCol = this.sanitizeIdentifier(column);
    this.queryValues.push(value);
    const paramIndex = this.queryValues.length;
    this.whereConditions.push(`${sanitizedCol} = $${paramIndex}`);
    return this;
  }

  /**
   * Adds an IN condition: `column IN ($A, $B, ...)`
   */
  whereIn(column: string, values: unknown[]): this {
    if (!values || values.length === 0) {
      this.whereConditions.push("1 = 0"); // Empty IN clause evaluates to false
      return this;
    }

    const sanitizedCol = this.sanitizeIdentifier(column);
    const placeholders: string[] = [];

    for (const val of values) {
      this.queryValues.push(val);
      placeholders.push(`$${this.queryValues.length}`);
    }

    this.whereConditions.push(`${sanitizedCol} IN (${placeholders.join(", ")})`);
    return this;
  }

  /**
   * Adds a raw condition clause with parameters: `whereRaw("salary > $N", 50000)`
   */
  whereRaw(conditionPattern: string, ...params: unknown[]): this {
    let replacedPattern = conditionPattern;

    for (const param of params) {
      this.queryValues.push(param);
      const placeholder = `$${this.queryValues.length}`;
      // Replace first occurrence of '?' or positional marker
      if (replacedPattern.includes("?")) {
        replacedPattern = replacedPattern.replace("?", placeholder);
      }
    }

    this.whereConditions.push(replacedPattern);
    return this;
  }

  /**
   * Adds an ORDER BY clause.
   */
  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    const sanitizedCol = this.sanitizeIdentifier(column);
    const sanitizedDir = direction.toUpperCase() === "DESC" ? "DESC" : "ASC";
    this.orderClauses.push(`${sanitizedCol} ${sanitizedDir}`);
    return this;
  }

  /**
   * Sets query LIMIT.
   */
  limit(limit: number): this {
    if (limit > 0) {
      this.limitCount = Math.floor(limit);
    }
    return this;
  }

  /**
   * Sets query OFFSET.
   */
  offset(offset: number): this {
    if (offset >= 0) {
      this.offsetCount = Math.floor(offset);
    }
    return this;
  }

  /**
   * Compiles the parameterized query string and value tuple.
   */
  build(): BuiltQuery {
    if (!this.tableName) {
      throw new Error("Cannot build query: table name is required. Call .from('table_name') first.");
    }

    const selectPart = `SELECT ${this.selectedFields.join(", ")} FROM ${this.tableName}`;
    let wherePart = "";
    if (this.whereConditions.length > 0) {
      wherePart = ` WHERE ${this.whereConditions.join(" AND ")}`;
    }

    let orderPart = "";
    if (this.orderClauses.length > 0) {
      orderPart = ` ORDER BY ${this.orderClauses.join(", ")}`;
    }

    let limitPart = "";
    if (this.limitCount !== null) {
      limitPart = ` LIMIT ${this.limitCount}`;
    }

    let offsetPart = "";
    if (this.offsetCount !== null) {
      offsetPart = ` OFFSET ${this.offsetCount}`;
    }

    return {
      text: `${selectPart}${wherePart}${orderPart}${limitPart}${offsetPart}`,
      values: [...this.queryValues],
    };
  }

  /**
   * Validates that SQL identifiers (columns, tables) only contain safe alphanumeric and underscore chars.
   */
  private sanitizeIdentifier(identifier: string): string {
    const trimmed = identifier.trim();
    if (trimmed === "*") return "*";

    // Allow qualified identifiers like `table.column` or function expressions like `COUNT(*)`
    if (/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?$/.test(trimmed)) {
      return trimmed;
    }
    if (/^COUNT\(\*\)(?:\s+AS\s+[a-zA-Z0-9_]+)?$/i.test(trimmed)) {
      return trimmed;
    }

    throw new Error(`Invalid or unsafe SQL identifier: "${identifier}". Identifiers must be alphanumeric/underscore.`);
  }
}

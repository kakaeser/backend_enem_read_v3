/**
 * Mock in-memory do PrismaService para o seam único de e2e/unit.
 * Implementa apenas o subconjunto da API usado pelos services:
 * findUnique/findFirst/findMany/create/createMany/update/updateMany/
 * delete/deleteMany/upsert/count/aggregate/$transaction, com
 * where (igualdade, in, lte/lt/gte/gt, AND/OR/NOT), orderBy
 * (incluindo 1 nível aninhado), select, include (relações + _count)
 * e erro P2002 nas uniques (question [examId,numero], adm.email).
 */
export class InMemoryPrisma {
  private tables: Record<string, { rows: any[]; seq: number }> = {};
  private defaultIds: Record<string, string> = { refreshToken: 'string' };

  adm = this.model('adm');
  aplicador = this.model('aplicador');
  exam = this.model('exam');
  participant = this.model('participant');
  question = this.model('question');
  answer = this.model('answer');
  refreshToken = this.model('refreshToken');

  private table(name: string) {
    if (!this.tables[name]) this.tables[name] = { rows: [], seq: 1 };
    return this.tables[name];
  }

  private model(name: string) {
    return {
      findUnique: (a: any = {}) => this.applyOne(name, this.findOne(name, a.where), a),
      findFirst: (a: any = {}) => this.applyOne(name, this.findOne(name, a.where), a),
      findMany: (a: any = {}) => this.findAll(name, a).map((r) => this.applyOne(name, r, a)),
      create: (a: any = {}) => this.applyOne(name, this.insert(name, { ...a.data }), a),
      createMany: (a: any = {}) => {
        for (const d of a.data ?? []) this.insert(name, { ...d });
        return { count: (a.data ?? []).length };
      },
      update: (a: any = {}) => {
        const row = this.findOne(name, a.where);
        if (!row) throw Object.assign(new Error('Not found'), { code: 'P2025' });
        Object.assign(row, a.data ?? {});
        return this.applyOne(name, row, a);
      },
      updateMany: (a: any = {}) => {
        let count = 0;
        for (const r of this.table(name).rows) {
          if (this.match(r, a.where)) {
            Object.assign(r, a.data ?? {});
            count++;
          }
        }
        return { count };
      },
      delete: (a: any = {}) => {
        const t = this.table(name);
        const idx = t.rows.findIndex((r) => this.match(r, a.where));
        if (idx < 0) throw Object.assign(new Error('Not found'), { code: 'P2025' });
        const [row] = t.rows.splice(idx, 1);
        return row;
      },
      deleteMany: (a: any = {}) => {
        const t = this.table(name);
        const before = t.rows.length;
        t.rows = t.rows.filter((r) => !this.match(r, a.where));
        return { count: before - t.rows.length };
      },
      upsert: (a: any = {}) => {
        const key = a.where?.userId_questId;
        const found = key
          ? this.table(name).rows.find((r) => r.userId === key.userId && r.questId === key.questId)
          : this.findOne(name, a.where);
        if (found) {
          Object.assign(found, a.update ?? {});
          return this.applyOne(name, found, a);
        }
        return this.applyOne(name, this.insert(name, { ...a.create }), a);
      },
      count: (a: any = {}) => this.table(name).rows.filter((r) => this.match(r, a.where)).length,
      aggregate: (a: any = {}) => {
        const rows = this.table(name).rows.filter((r) => this.match(r, a.where));
        const sum = rows.reduce((s, r) => s + (r.peso ?? 0), 0);
        return { _sum: { peso: rows.length ? sum : null } };
      },
    };
  }

  async $transaction(cb: (tx: any) => any) {
    return cb(this);
  }

  private insert(name: string, data: any) {
    this.checkUnique(name, data);
    const t = this.table(name);
    if (data.id === undefined) {
      data.id = this.defaultIds[name] === 'string' ? `c_${t.seq}_${Date.now()}` : t.seq;
    }
    if (typeof data.id === 'number' && data.id >= t.seq) t.seq = data.id + 1;
    if (typeof data.id === 'string') t.seq++;
    t.rows.push(data);
    return data;
  }

  private checkUnique(name: string, data: any) {
    const err = () => Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    const rows = this.table(name).rows;
    if (name === 'question' && rows.some((r) => r.examId === data.examId && r.numero === data.numero)) throw err();
    if (name === 'adm' && rows.some((r) => r.email === data.email)) throw err();
    if (name === 'refreshToken' && rows.some((r) => r.tokenHash === data.tokenHash)) throw err();
  }

  private findOne(name: string, where: any) {
    return this.table(name).rows.find((r) => this.match(r, where));
  }

  private findAll(name: string, a: any = {}) {
    let rows = this.table(name).rows.filter((r) => this.match(r, a.where));
    const order = a.orderBy ? (Array.isArray(a.orderBy) ? a.orderBy : [a.orderBy]) : [];
    for (const o of order.reverse()) {
      const [field, dir] = Object.entries(o)[0] as [string, any];
      rows = [...rows].sort((x, y) => {
        const xv = this.resolve(x, name, field, dir);
        const yv = this.resolve(y, name, field, dir);
        const cmp = xv < yv ? -1 : xv > yv ? 1 : 0;
        return dir === 'desc' ? -cmp : cmp;
      });
    }
    return rows;
  }

  private resolve(row: any, model: string, field: string, dir: any) {
    if (typeof dir === 'object' && dir !== null) {
      const [sub] = Object.entries(dir)[0] as [string, any];
      const rel = this.relation(model, row, field);
      const v = Array.isArray(rel) ? rel[0]?.[sub] : rel?.[sub];
      return v ?? '';
    }
    return row[field];
  }

  private match(row: any, where: any): boolean {
    if (!where || !Object.keys(where).length) return true;
    return Object.entries(where).every(([k, v]) => {
      if (k === 'AND') return (v as any[]).every((c) => this.match(row, c));
      if (k === 'OR') return (v as any[]).some((c) => this.match(row, c));
      if (k === 'NOT') return !this.match(row, v);
      if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
        return Object.entries(v as any).every(([op, val]) => {
          const rv = row[k] instanceof Date ? row[k].getTime() : row[k];
          const cv = val instanceof Date ? (val as Date).getTime() : val;
          if (op === 'in') return (val as any[]).includes(row[k]);
          if (op === 'equals') return row[k] === val;
          if (op === 'lte') return rv <= (cv as any);
          if (op === 'lt') return rv < (cv as any);
          if (op === 'gte') return rv >= (cv as any);
          if (op === 'gt') return rv > (cv as any);
          return false;
        });
      }
      return row[k] === v;
    });
  }

  private applyOne(model: string, row: any, args: any) {
    if (!row) return row;
    let out: any = { ...row };
    if (args?.select) {
      out = {};
      for (const [k, v] of Object.entries(args.select)) {
        if (v && row[k] !== undefined) out[k] = row[k];
      }
    }
    if (args?.include) {
      for (const [k, v] of Object.entries(args.include as any)) {
        if (!v) continue;
        if (k === '_count' && typeof v === 'object') {
          out._count = {};
          for (const ck of Object.keys(v.select ?? {})) {
            out._count[ck] = this.countChildren(model, row, ck);
          }
          continue;
        }
        const rel = this.relation(model, row, k);
        if (Array.isArray(rel)) {
          out[k] = rel.map((r) => this.applyOne(this.childModel(model, k), r, typeof v === 'object' ? v : {}));
        } else if (rel) {
          out[k] = this.applyOne(this.childModel(model, k), rel, typeof v === 'object' ? v : {});
        } else {
          out[k] = rel;
        }
      }
    }
    return out;
  }

  private childModel(model: string, rel: string): string {
    const map: Record<string, Record<string, string>> = {
      answer: { user: 'participant', quest: 'question' },
      participant: { exam: 'exam', aplicador: 'aplicador', answers: 'answer' },
      question: { exam: 'exam', answers: 'answer' },
      exam: { questions: 'question', participants: 'participant', aplicadores: 'aplicador' },
      aplicador: { prova: 'exam', participants: 'participant' },
      refreshToken: { adm: 'adm' },
    };
    return map[model]?.[rel] ?? rel;
  }

  private relation(model: string, row: any, rel: string): any {
    const T = (m: string) => this.table(m).rows;
    switch (`${model}.${rel}`) {
      case 'answer.user':
        return T('participant').find((r) => r.id === row.userId);
      case 'answer.quest':
        return T('question').find((r) => r.id === row.questId);
      case 'participant.exam':
        return T('exam').find((r) => r.id === row.examId);
      case 'participant.aplicador':
        return T('aplicador').find((r) => r.id === row.aplicadorId);
      case 'participant.answers':
        return T('answer').filter((r) => r.userId === row.id);
      case 'question.exam':
        return T('exam').find((r) => r.id === row.examId);
      case 'question.answers':
        return T('answer').filter((r) => r.questId === row.id);
      case 'exam.questions':
        return T('question').filter((r) => r.examId === row.id);
      case 'exam.participants':
        return T('participant').filter((r) => r.examId === row.id);
      case 'exam.aplicadores':
        return T('aplicador').filter((r) => r.provaId === row.id);
      case 'aplicador.prova':
        return T('exam').find((r) => r.id === row.provaId);
      case 'aplicador.participants':
        return T('participant').filter((r) => r.aplicadorId === row.id);
      case 'refreshToken.adm':
        return T('adm').find((r) => r.id === row.admId);
      default:
        return undefined;
    }
  }

  private countChildren(model: string, row: any, key: string): number {
    const rel = this.relation(model, row, key);
    return Array.isArray(rel) ? rel.length : rel ? 1 : 0;
  }
}

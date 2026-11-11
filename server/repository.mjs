import { accountInput, obligationInput, transactionInput, paymentInput } from './validation.mjs';

/** Parameterized queries only; server-side DB owns all financial records. */
export function createRepository(pool) {
  return {
    async addAccount(value) {
      const x = accountInput(value);
      await pool.query('INSERT INTO accounts(id,project,currency,label) VALUES($1,$2,$3,$4)',[x.id,x.project,x.currency,x.label]);
      return x;
    },
    async addObligation(value) {
      const x = obligationInput(value);
      await pool.query('INSERT INTO obligations(id,project,amount_minor,currency,due_date) VALUES($1,$2,$3,$4,$5)',[x.id,x.project,x.amountMinor,x.currency,x.dueDate]);
      return x;
    },
    async addTransaction(value) {
      const x = transactionInput(value);
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const a=await client.query('SELECT project,currency FROM accounts WHERE id=$1 FOR UPDATE',[x.accountId]);
        if(a.rowCount!==1) throw new Error('Unknown account');
        if(a.rows[0].project!==x.project || a.rows[0].currency!==x.currency) throw new Error('Account project/currency mismatch');
        await client.query('INSERT INTO transactions(id,account_id,project,kind,amount_minor,currency,occurred_on,source_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[x.id,x.accountId,x.project,x.kind,x.amountMinor,x.currency,x.occurredOn,x.sourceId]);
        await client.query('COMMIT');
        return x;
      } catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async addPayment(value) {
      const x = paymentInput(value);
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const o=await client.query('SELECT project,currency FROM obligations WHERE id=$1 FOR UPDATE',[x.obligationId]);
        if(o.rowCount!==1) throw new Error('Unknown obligation');
        if(o.rows[0].currency!==x.currency) throw new Error('Payment currency mismatch');
        if(x.state==='confirmed') {
          const t=await client.query('SELECT project,currency,kind,source_id,amount_minor FROM transactions WHERE id=$1 FOR UPDATE',[x.bankTransactionId]);
          if(t.rowCount!==1 || t.rows[0].kind!=='expense' || t.rows[0].currency!==x.currency || t.rows[0].project!==o.rows[0].project) throw new Error('Confirmed payment requires matching bank expense');
          const allocated=await client.query("SELECT COALESCE(SUM(amount_minor),0)::text AS used FROM payments WHERE bank_transaction_id=$1 AND state='confirmed'",[x.bankTransactionId]);
          if(BigInt(allocated.rows[0].used)+BigInt(x.amountMinor)>BigInt(t.rows[0].amount_minor)) throw new Error('Bank expense allocation exceeds transaction');
        }
        await client.query('INSERT INTO payments(id,obligation_id,amount_minor,currency,state,bank_transaction_id) VALUES($1,$2,$3,$4,$5,$6)',[x.id,x.obligationId,x.amountMinor,x.currency,x.state,x.bankTransactionId]);
        await client.query('COMMIT');
        return x;
      } catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async getObligation(id) {
      const x = await pool.query('SELECT id,project,amount_minor::text AS amount_minor,currency,due_date::text AS due_date FROM obligations WHERE id=$1',[id]);
      if(!x.rowCount) return null;
      const p=await pool.query('SELECT id,amount_minor::text AS amount_minor,currency,state,bank_transaction_id FROM payments WHERE obligation_id=$1 ORDER BY created_at,id',[id]);
      const paid=p.rows.filter(z=>z.state==='confirmed').reduce((sum,z)=>sum+BigInt(z.amount_minor),0n);
      const total=BigInt(x.rows[0].amount_minor);
      const remaining=total>paid?total-paid:0n;
      return { id:x.rows[0].id,project:x.rows[0].project,currency:x.rows[0].currency,dueDate:x.rows[0].due_date,amountMinor:total.toString(),paidMinor:paid.toString(),remainingMinor:remaining.toString(),overpaidMinor:(paid>total?paid-total:0n).toString(),payments:p.rows.map(z=>({id:z.id,amountMinor:z.amount_minor,currency:z.currency,state:z.state,bankTransactionId:z.bank_transaction_id})) };
    }
  };
}

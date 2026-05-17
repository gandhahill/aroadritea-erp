-- SD §15, §25.1 — audit_log must be append-only at the database layer.
-- The application connection (and any other DB role except DROP-TRIGGER admins)
-- is blocked from UPDATE or DELETE on the table. Inserts remain unrestricted.
--
-- Defense-in-depth: even if a logic bug or compromised user tries to
-- rewrite history, the database raises an exception and the transaction
-- rolls back. To purge per regulatory request, a superuser must drop the
-- triggers, run the operation, and restore them — leaving its own paper
-- trail in the postgres logs.

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only — % rejected', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_immutable();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_log_immutable();

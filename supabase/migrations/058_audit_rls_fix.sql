-- Widen audit_events visibility to all admin-panel roles
DROP POLICY IF EXISTS "Admin/ops can view audit events" ON audit_events;

CREATE POLICY "Admin/management/support can view audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'support')
    )
  );

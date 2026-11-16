-- Only standard roles receive new technical type permissions. Custom roles unchanged.
INSERT INTO role_permissions(role_id,permission)
SELECT wr.id,'element.'||a.action||'.'||t.kind
FROM workspace_roles wr
CROSS JOIN (VALUES ('uml-datatype'),('uml-primitive'),('uml-association-class'),('uml-comment')) t(kind)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) a(action)
WHERE wr.role_key IN ('owner','admin','technical') OR (wr.role_key='viewer' AND a.action='view')
ON CONFLICT DO NOTHING;

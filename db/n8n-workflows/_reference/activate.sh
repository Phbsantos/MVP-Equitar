#!/bin/bash
# Ativa um workflow já importado nesta instância n8n "enterprise fork":
# active=true sozinho não basta (existe um segundo conceito de "versão
# publicada" — activeVersionId aponta pra um snapshot em workflow_history).
# Uso: ./activate.sh <workflow_id>
set -e
WF_ID="$1"
MSYS_NO_PATHCONV=1 docker exec postgres_n8n psql -U n8n_user -d n8n_db -c "
DO \$\$
DECLARE
  v_version_id varchar(36) := uuid_generate_v4()::text;
BEGIN
  INSERT INTO workflow_history (\"versionId\", \"workflowId\", authors, nodes, connections, name, autosaved, \"nodeGroups\")
  SELECT v_version_id, id, 'Paulo Santos', nodes, connections, name, false, \"nodeGroups\"
  FROM workflow_entity WHERE id = '$WF_ID';

  UPDATE workflow_entity SET \"activeVersionId\" = v_version_id, active = true WHERE id = '$WF_ID';

  INSERT INTO workflow_published_version (\"workflowId\", \"publishedVersionId\")
  VALUES ('$WF_ID', v_version_id)
  ON CONFLICT (\"workflowId\") DO UPDATE SET \"publishedVersionId\" = EXCLUDED.\"publishedVersionId\";
END \$\$;
"

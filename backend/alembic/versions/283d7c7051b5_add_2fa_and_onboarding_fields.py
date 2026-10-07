"""add_2fa_and_onboarding_fields

Revision ID: 283d7c7051b5
Revises: 4fa40de9d6bd
Create Date: 2026-10-07 19:38:51.291740

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '283d7c7051b5'
down_revision: Union[str, None] = '4fa40de9d6bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('totp_secret', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('is_totp_enabled', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('backup_codes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('has_completed_onboarding', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('has_completed_onboarding')
        batch_op.drop_column('backup_codes')
        batch_op.drop_column('is_totp_enabled')
        batch_op.drop_column('totp_secret')

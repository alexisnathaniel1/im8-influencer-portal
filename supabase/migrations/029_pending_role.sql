-- Add 'pending' to user_role enum for new staff accounts awaiting activation
alter type user_role add value if not exists 'pending';

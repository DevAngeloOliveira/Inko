INSERT INTO livros (id, titulo, autor, categoria, volume, editora, titulo_original) VALUES
    ('INK-0001', 'Maré de Tinta', 'Aiko Tanabe', 'Mangá', 'Vol. 3', 'Editora Sumi', '墨の潮'),
    ('INK-0002', 'O Último Ronin', 'Kenji Arata', 'Mangá', 'Vol. 12', 'Editora Sumi', '最後の浪人'),
    ('INK-0003', 'Capitão Ferrugem', 'Rafael Moura', 'HQ', '#27', 'Farol Quadrinhos', NULL),
    ('INK-0004', 'Kitsune Express', 'Haru Mizuki', 'Mangá', 'Vol. 5', 'Washi Press', '狐エクスプレス'),
    ('INK-0005', 'Jardim de Aço', 'Sora Ikeda', 'Mangá', 'Vol. 1', 'Washi Press', '鋼の庭'),
    ('INK-0006', 'Noite Sem Lua', 'Lia Sato', 'Graphic novel', NULL, 'Farol Quadrinhos', NULL),
    ('INK-0007', 'Liga dos Faróis', 'Bruno Teles', 'HQ', '#4', 'Farol Quadrinhos', NULL),
    ('INK-0008', 'Pétalas de Ferro', 'Mei Kurogane', 'Mangá', 'Vol. 2', 'Editora Sumi', '鉄の花びら'),
    ('INK-0009', 'Kitsune Express', 'Haru Mizuki', 'Mangá', 'Vol. 4', 'Washi Press', '狐エクスプレス'),
    ('INK-0010', 'Liga dos Faróis', 'Bruno Teles', 'HQ', '#3', 'Farol Quadrinhos', NULL),
    ('INK-0011', 'Jardim de Aço', 'Sora Ikeda', 'Mangá', 'Vol. 2', 'Washi Press', '鋼の庭'),
    ('INK-0012', 'Maré de Tinta', 'Aiko Tanabe', 'Mangá', 'Vol. 4', 'Editora Sumi', '墨の潮')
ON CONFLICT (id) DO NOTHING;

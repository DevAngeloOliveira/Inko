package br.com.inko.usuarios.usuario;

import br.com.inko.usuarios.api.ApiException;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {
    private final UsuarioRepository repository;

    public UsuarioService(UsuarioRepository repository) {
        this.repository = repository;
    }

    public Usuario cadastrar(Usuario usuario) {
        if (repository.existeMatricula(usuario.matricula())) {
            throw matriculaDuplicada(usuario.matricula());
        }
        if (usuario.email() != null && repository.existeEmail(usuario.email())) {
            throw emailDuplicado();
        }
        try {
            return repository.inserir(usuario);
        } catch (DuplicateKeyException exception) {
            String detalhe = String.valueOf(exception.getMessage());
            throw detalhe.contains("email") ? emailDuplicado() : matriculaDuplicada(usuario.matricula());
        }
    }

    public Usuario buscar(String id) {
        return repository.buscar(id.toUpperCase())
                .orElseThrow(() -> ApiException.naoEncontrado("Usuário " + id + " não encontrado."));
    }

    public List<Usuario> listar(String termo) {
        List<Usuario> usuarios = repository.listar();
        if (termo == null || termo.isBlank()) {
            return usuarios;
        }
        String procurado = normalizar(termo);
        return usuarios.stream()
                .filter(usuario -> normalizar(usuario.id() + " " + usuario.nome() + " " + usuario.matricula() + " "
                        + (usuario.email() == null ? "" : usuario.email())).contains(procurado))
                .toList();
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static ApiException matriculaDuplicada(String matricula) {
        return ApiException.conflito("DUPLICATE_MATRICULA", "A matrícula " + matricula + " já está cadastrada.", "matricula");
    }

    private static ApiException emailDuplicado() {
        return ApiException.conflito("DUPLICATE_EMAIL", "Já existe um usuário com este e-mail.", "email");
    }
}
